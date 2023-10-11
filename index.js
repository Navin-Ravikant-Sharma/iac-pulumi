import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import env from 'dotenv';

env.config();

//creating VPC
const myvpc = new aws.ec2.Vpc("iacVPC", {
    cidrBlock: process.env.cidrBlock,
    tags: {
        Name: "iacVPC",
    },
});

// creating subnet 

// Create public subnets
const publicSubnets = [];
const available = aws.getAvailabilityZones({
    state: "available",
});

for (let i = 0; i < 3; i++) {
    const pubsubnet = new aws.ec2.Subnet(`publicSubnet${i}`, {
        vpcId: myvpc.id,
        availabilityZone: available.then(available => available.names?.[i]),
        cidrBlock: pulumi.interpolate`10.0.${i}.0/24`,
        mapPublicIpOnLaunch: true,
        tags: {
            Name: "public subnet",
        },
    });
    publicSubnets.push(pubsubnet);
}

// Create private subnets
const privateSubnets = [];
for (let i = 0; i < 3; i++) {
    const privsubnet = new aws.ec2.Subnet(`privateSubnet${i}`, {
        vpcId: myvpc.id,
        availabilityZone: available.then(available => available.names?.[i]),
        cidrBlock: pulumi.interpolate`10.0.${i + 10}.0/24`,
        tags: {
            Name: "private subnet",
        },
    });
    privateSubnets.push(privsubnet);
}

//creating internet gateway

const internet = new aws.ec2.InternetGateway("internetGateway", {
    vpcId: myvpc.id,
    tags: {
        Name: "iacVPC gateway",
    },
});

// Create a public route table
const pubRouteTable = new aws.ec2.RouteTable("pubRouteTable", {
    vpcId: myvpc.id,
    tags: {
        Name: "public route table",
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
        Name: "private route table",
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
    destinationCidrBlock: process.env.destination_cidr,
    gatewayId: internet.id,
    tags: {
        Name: "public route for destination",
    },
});