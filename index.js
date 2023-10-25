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

const array = config.config['iacpulumi:cidrBlockSubnet'].split(".");

available.then(available => {
    const zoneCount = available.names?.length || 0;

    for (let i = 0; i < zoneCount && i < parseInt(config.config['iacpulumi:max_count']); i++) {
        // Create public subnets
        const SubnetPublicCidr = array[0] + "." + array[1] + "." + i + "." + array[3];
        const pubsubnet = new aws.ec2.Subnet(config.config['iacpulumi:publicSubnet']+ i, {
            vpcId: myvpc.id,
            availabilityZone: available.names?.[i],
            cidrBlock: SubnetPublicCidr,
            mapPublicIpOnLaunch: true,
            tags: {
                Name: config.config['iacpulumi:publicSubnet'],
            },
        });
        publicSubnets.push(pubsubnet);

        // Create private subnets
        const ipTotal = i + parseInt(config.config['iacpulumi:max_count']);
        const SubnetPrivateCidr = array[0] + "." + array[1] + "." + ipTotal + "." + array[3];
        const privsubnet = new aws.ec2.Subnet(config.config['iacpulumi:privateSubnet']+ i , {
            vpcId: myvpc.id,
            availabilityZone: available.names?.[i],
            cidrBlock: SubnetPrivateCidr,
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
        const routeTable = new aws.ec2.RouteTableAssociation(config.config['iacpulumi:publicRoute']+`${index}`, {
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
        const routeTable = new aws.ec2.RouteTableAssociation(config.config['iacpulumi:privateRoute']+`${index}`, {
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
                fromPort: config.config['iacpulumi:webapp_Port'],
                toPort: config.config['iacpulumi:webapp_Port'],
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
                cidrBlocks: [config.config['iacpulumi:SSHip']],
            },
        ],
        tags: {
            Name: config.config['iacpulumi:SecurityGroup'],
        }
    });

    const securityGroupRDS = new aws.ec2.SecurityGroup(config.config['iacpulumi:RDSSecurityGroup'], {
        vpcId: myvpc.id,
        ingress: [
            {
                protocol: config.config['iacpulumi:Protocol'],
                fromPort: config.config['iacpulumi:MySQL_Port'],
                toPort: config.config['iacpulumi:MySQL_Port'],
                security_groups: [securityGroup.id],
            },
        ],
        egress: [
            {
                protocol: config.config['iacpulumi:RestrictedProtocol'],
                fromPort: config.config['iacpulumi:Restricted_Port'],
                toPort: config.config['iacpulumi:Restricted_Port'],
                security_groups: [securityGroup.id],
                cidrBlocks: [config.config['iacpulumi:destination_cidr']],
            },
        ],
        tags: {
            Name: config.config['iacpulumi:RDSSecurityGroup'],
        }
    });

    const rds_parameter = new aws.rds.ParameterGroup(config.config['iacpulumi:parameterGrouptName'], {
        family: config.config['iacpulumi:parameterGrouptName'],
        vpcId: myvpc.id,
        parameters: [{
            name: config.config['iacpulumi:parameterGroupParameterName'],
            value: config.config['iacpulumi:parameterGroupParameterValue']
        }]
    });

    const privateSubnetID = privateSubnets.map(subnet => subnet.id);

    const privateSubnetGroup = new aws.rds.SubnetGroup(config.config['iacpulumi:subnetGroup'], {
        subnetIds: privateSubnetID,
        tags: {
            Name: config.config['iacpulumi:privateSubnetGroup'],
        },
    });

    const RDS_Instance = new aws.rds.Instance(config.config['iacpulumi:rdsInstance'], {
        allocatedStorage: config.config['iacpulumi:allocatedStorage'],
        storageType: config.config['iacpulumi:storageType'],
        engine: config.config['iacpulumi:engine'],
        engineVersion: config.config['iacpulumi:engineVersion'],
        skipFinalSnapshot: config.config['iacpulumi:skipFinalSnapshot'],
        instanceClass: config.config['iacpulumi:instanceClass'],
        multiAz: config.config['iacpulumi:multiAz'],
        dbName: config.config['iacpulumi:dbName'],
        username: config.config['iacpulumi:username'],
        password: config.config['iacpulumi:password'],
        parameterGroupName: rds_parameter.name,
        dbSubnetGroupName: privateSubnetGroup,
        vpcSecurityGroupIds: [securityGroupRDS.id, securityGroup.id],
        publiclyAccessible: config.config['iacpulumi:publiclyAccessible'],
    })

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

    RDS_Instance.endpoint.apply(endpoint => {
        const instance = new aws.ec2.Instance(config.config['iacpulumi:instanceTag'], {
            ami: ami.then(i => i.id),
            instanceType: config.config['iacpulumi:instanceType'],
            subnetId: publicSubnets[0],
            keyName: config.config['iacpulumi:keyValue'],
            associatePublicIpAddress: config.config['iacpulumi:associatePublicIpAddress'],
            vpcSecurityGroupIds: [
                securityGroup.id,
                securityGroupRDS.id,
            ],
            userData: pulumi.interpolate`#!/bin/bash
                echo "host=${endpoint}" >> /home/admin/opt/webapp/.env
                echo "user=${config.config['iacpulumi:user']}" >> /home/admin/opt/webapp/.env
                echo "pd=${config.config['iacpulumi:pd']}" >> /home/admin/opt/webapp/.env
                echo "port=${config.config['iacpulumi:port']}" >> /home/admin/opt/webapp/.env
                echo "dialect=${config.config['iacpulumi:dialect']}" >> /home/admin/opt/webapp/.env
                echo "database=${config.config['iacpulumi:database']}" >> /home/admin/opt/webapp/.env
            `,
        });
    });
});