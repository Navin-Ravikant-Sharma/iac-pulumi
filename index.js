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

// Create public subnets in different availability zones
const publicSubnets = [];
const available = aws.getAvailabilityZones({
    state: "available",
});
for (let i = 0; i < 3; i++) {
    const subnet = new aws.ec2.Subnet(`publicSubnet${i}`, {
        vpcId: myvpc.id,
        availabilityZone: available.then(available => available.names?.[i]),
        cidrBlock: pulumi.interpolate`10.0.${i}.0/24`,
        mapPublicIpOnLaunch: true,
    });
    publicSubnets.push(subnet);
}

// Create private subnets in different availability zones
const privateSubnets = [];
for (let i = 0; i < 3; i++) {
    const subnet = new aws.ec2.Subnet(`privateSubnet${i}`, {
        vpcId: myvpc.id,
        availabilityZone: available.then(available => available.names?.[i]),
        cidrBlock: pulumi.interpolate`10.0.${i + 10}.0/24`,
    });
    privateSubnets.push(subnet);
}