import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import yaml from "js-yaml";
import * as fs from "fs";

const stackName = pulumi.getStack();
console.log("stack", stackName);
const configFile = fs.readFileSync(`pulumi.${stackName}.yaml`, 'utf8');
const config = yaml.safeLoad(configFile);

// Creating VPC
const myvpc = new aws.ec2.Vpc("iacVPC", {
    cidrBlock: config.config['iacpulumi:cidrBlock'],
    tags: {
        Name: "MyVPC",
    },
});

// Creating subnet 

// Create public subnets
const publicSubnets = [];
const privateSubnets = [];
const available = aws.getAvailabilityZones({
    state: "available",
});

available.then(available => {
    const zoneCount = available.names?.length || 0;

    for (let i = 0; i < zoneCount && i < 3; i++) {
        // Create public subnets
        const pubsubnet = new aws.ec2.Subnet(`publicSubnet${i}`, {
            vpcId: myvpc.id,
            availabilityZone: available.names?.[i],
            cidrBlock: pulumi.interpolate`10.0.${i}.0/24`,
            mapPublicIpOnLaunch: true,
            tags: {
                Name: "Public Subnet",
            },
        });
        publicSubnets.push(pubsubnet);

        // Create private subnets
        const privsubnet = new aws.ec2.Subnet(`privateSubnet${i}`, {
            vpcId: myvpc.id,
            availabilityZone: available.names?.[i],
            cidrBlock: pulumi.interpolate`10.0.${i + 10}.0/24`,
            tags: {
                Name: "Private Subnet",
            },
        });
        privateSubnets.push(privsubnet);
    }

    // Creating internet gateway
    const internet = new aws.ec2.InternetGateway("internetGateway", {
        vpcId: myvpc.id,
        tags: {
            Name: "Internet Gateway",
        },
    });

    // Create a public route table
    const pubRouteTable = new aws.ec2.RouteTable("pubRouteTable", {
        vpcId: myvpc.id,
        tags: {
            Name: "Public Route Table",
        },
    });

    // Attach all public subnets to the public route table
    publicSubnets.forEach((subnet, index) => {
        const routeTable = new aws.ec2.RouteTableAssociation(`pubRoute${index}`, {
            routeTableId: pubRouteTable.id,
            subnetId: subnet.id,
        });
    });

    // Create a private route table
    const privRouteTable = new aws.ec2.RouteTable("privRouteTable", {
        vpcId: myvpc.id,
        tags: {
            Name: "Private Route Table",
        },
    });

    // Attach all private subnets to the private route table
    privateSubnets.forEach((subnet, index) => {
        const routeTable = new aws.ec2.RouteTableAssociation(`privRoute${index}`, {
            routeTableId: privRouteTable.id,
            subnetId: subnet.id,
        });
    });

    const publicRoute = new aws.ec2.Route("pubRoute", {
        routeTableId: pubRouteTable.id,
        destinationCidrBlock: config.config['iacpulumi:destination_cidr'],
        gatewayId: internet.id,
        tags: {
            Name: "Public Route for Destination",
        },
    });

    const securityGroup = new aws.ec2.SecurityGroup("SecurityGroup", {
        vpcId: myvpc.id,
        ingress: [
            {
                protocol: "tcp",
                fromPort: 80,
                toPort: 80,
                cidrBlocks: ["0.0.0.0/0"],
                ipv6_cidr_blocks: ["::/0"],
            },
            {
                protocol: "tcp",
                fromPort: 443,
                toPort: 443,
                cidrBlocks: ["0.0.0.0/0"],
                ipv6_cidr_blocks: ["::/0"],
            },
            {
                protocol: "tcp",
                fromPort: 22,
                toPort: 22,
                cidrBlocks: ["10.0.0.41/32"],
            },
        ],
        tags: {
            Name: "iac_Security_Group",
        }
    });

    const ami = aws.ec2.getAmi({
        filters: [
            {
                name: "name",
                values: ["csye6225_iac_and_webapp_ami"],
            },
            {
                name: "root-device-type",
                values: ["ebs"],
            },
            {
                name: "virtualization-type",
                values: ["hvm"],
            },
        ],
        mostRecent: true,
        owners: ["412145925921"],
    });

    const instance = new aws.ec2.Instance("iac_Instance", {
        ami: ami.then(i => i.id),
        instanceType: "t2.micro",
        subnetId: publicSubnets[0],
        keyName: "pulumiKey",
        associatePublicIpAddress: true,
        vpcSecurityGroupIds: [
            securityGroup.id,
        ]
    });

});