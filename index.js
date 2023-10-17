import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import yaml from "js-yaml";
import * as fs from "fs";

const stackName = pulumi.getStack();
const configFile = fs.readFileSync(`pulumi.${stackName}.yaml`, 'utf8');
const config = yaml.safeLoad(configFile);

// Creating VPC
const myvpc = new aws.ec2.Vpc(config.config['iacpulumi:vpc_tag_name'], {
    cidrBlock: config.config['iacpulumi:cidrBlock'],
    tags: {
        Name: config.config['iacpulumi:vpc_tag_name'],
    },
});

// Creating subnet 

// Create public subnets
const publicSubnets = [];
const privateSubnets = [];
const available = aws.getAvailabilityZones({
    state: config.config['iacpulumi:state'],
});

available.then(available => {
    const zoneCount = available.names?.length || 0;

    for (let i = 0; i < zoneCount && i < config.config['iacpulumi:max_count']; i++) {
        // Create public subnets
        const pubsubnet = new aws.ec2.Subnet(config.config['iacpulumi:publicSubnet']`${i}`, {
            vpcId: myvpc.id,
            availabilityZone: available.names?.[i],
            cidrBlock: pulumi.interpolate`10.0.${i}.0/24`,
            mapPublicIpOnLaunch: true,
            tags: {
                Name: config.config['iacpulumi:publicSubnet'],
            },
        });
        publicSubnets.push(pubsubnet);

        // Create private subnets
        const privsubnet = new aws.ec2.Subnet(config.config['iacpulumi:privateSubnet']`${i}`, {
            vpcId: myvpc.id,
            availabilityZone: available.names?.[i],
            cidrBlock: pulumi.interpolate`10.0.${i + 10}.0/24`,
            tags: {
                Name: config.config['iacpulumi:privateSubnet'],
            },
        });
        privateSubnets.push(privsubnet);
    }

    // Creating internet gateway
    const internet = new aws.ec2.InternetGateway(config.config['iacpulumi:internetGateway'], {
        vpcId: myvpc.id,
        tags: {
            Name: config.config['iacpulumi:internetGateway'],
        },
    });

    // Create a public route table
    const pubRouteTable = new aws.ec2.RouteTable(config.config['iacpulumi:publicRouteTable'], {
        vpcId: myvpc.id,
        tags: {
            Name: config.config['iacpulumi:publicRouteTable'],
        },
    });

    // Attach all public subnets to the public route table
    publicSubnets.forEach((subnet, index) => {
        const routeTable = new aws.ec2.RouteTableAssociation(config.config['iacpulumi:publicRoute']`${index}`, {
            routeTableId: pubRouteTable.id,
            subnetId: subnet.id,
        });
    });

    // Create a private route table
    const privRouteTable = new aws.ec2.RouteTable(config.config['iacpulumi:privateRouteTable'], {
        vpcId: myvpc.id,
        tags: {
            Name: config.config['iacpulumi:privateRouteTable'],
        },
    });

    // Attach all private subnets to the private route table
    privateSubnets.forEach((subnet, index) => {
        const routeTable = new aws.ec2.RouteTableAssociation(config.config['iacpulumi:privateRoute']`${index}`, {
            routeTableId: privRouteTable.id,
            subnetId: subnet.id,
        });
    });

    const publicRoute = new aws.ec2.Route("pubRoute", {
        routeTableId: pubRouteTable.id,
        destinationCidrBlock: config.config['iacpulumi:destination_cidr'],
        gatewayId: internet.id,
        tags: {
            Name: config.config['iacpulumi:publicRouteForDestinationTag'],
        },
    });

    const securityGroup = new aws.ec2.SecurityGroup(config.config['iacpulumi:SecurityGroup'], {
        vpcId: myvpc.id,
        ingress: [
            {
                protocol: config.config['iacpulumi:Protocol'],
                fromPort: config.config['iacpulumi:HTTP_Port'],
                toPort: config.config['iacpulumi:HTTP_Port'],
                cidrBlocks: [config.config['iacpulumi:ipv4']],
                ipv6_cidr_blocks: [config.config['iacpulumi:ipv6']],
            },
            {
                protocol: config.config['iacpulumi:Protocol'],
                fromPort: config.config['iacpulumi:HTTPS_Port'],
                toPort: config.config['iacpulumi:HTTPS_Port'],
                cidrBlocks: [config.config['iacpulumi:ipv4']],
                ipv6_cidr_blocks: [config.config['iacpulumi:ipv6']],
            },
            {
                protocol: config.config['iacpulumi:Protocol'],
                fromPort: config.config['iacpulumi:SSHPort'],
                toPort: config.config['iacpulumi:SSHPort'],
                cidrBlocks: config.config['iacpulumi:SSHip'],
            },
        ],
        tags: {
            Name: config.config['iacpulumi:SecurityGroup'],
        }
    });

    const ami = aws.ec2.getAmi({
        filters: [
            {
                name: config.config['iacpulumi:AMIName'],
                values: [config.config['iacpulumi:AMINameValue']],
            },
            {
                name: config.config['iacpulumi:rootDeviceTypeTag'],
                values: [config.config['iacpulumi:rootDeviceTypeTagValue']],
            },
            {
                name: config.config['iacpulumi:virtualizationTag'],
                values: [config.config['iacpulumi:virtualizationTagValue']],
            },
        ],
        mostRecent: true,
        owners: [config.config['iacpulumi:owner']],
    });

    const instance = new aws.ec2.Instance(config.config['iacpulumi:instanceTag'], {
        ami: ami.then(i => i.id),
        instanceType: config.config['iacpulumi:instanceType'],
        subnetId: publicSubnets[0],
        keyName: config.config['iacpulumi:keyValue'],
        associatePublicIpAddress: true,
        vpcSecurityGroupIds: [
            securityGroup.id,
        ]
    });

});