import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

//creating VPC
const main = new aws.ec2.Vpc("iacVPC", {
    cidrBlock: "10.0.0.0/16",
    tags: {
        Name: "iacVPC",
    },
});