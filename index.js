import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import yaml from "js-yaml";
import * as fs from "fs";

const configFile = fs.readFileSync('pulumi.dev.yaml', 'utf8');
const config = yaml.safeLoad(configFile);

// Creating VPC
const myvpc = new aws.ec2.Vpc("iacVPC", {
    cidrBlock: config.config.env.cidrBlock,
    tags: {
        Name: config.tags.iacVPC,
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
                Name: config.tags.publicSubnet,
            },
        });
        publicSubnets.push(pubsubnet);

        // Create private subnets
        const privsubnet = new aws.ec2.Subnet(`privateSubnet${i}`, {
            vpcId: myvpc.id,
            availabilityZone: available.names?.[i],
            cidrBlock: pulumi.interpolate`10.0.${i + 10}.0/24`,
            tags: {
                Name: config.tags.privateSubnet,
            },
        });
        privateSubnets.push(privsubnet);
    }

    // Creating internet gateway
    const internet = new aws.ec2.InternetGateway("internetGateway", {
        vpcId: myvpc.id,
        tags: {
            Name: config.tags.internetGateway,
        },
    });

    // Create a public route table
    const pubRouteTable = new aws.ec2.RouteTable("pubRouteTable", {
        vpcId: myvpc.id,
        tags: {
            Name: config.tags.publicRouteTable,
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
            Name: config.tags.privateRouteTable,
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
        destinationCidrBlock: config.config.env.destination_cidr,
        gatewayId: internet.id,
        tags: {
            Name: config.tags.publicRoute,
        },
    });
});
