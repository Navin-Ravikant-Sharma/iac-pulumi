# iac-pulumi

## INTRODUCTION

Configuration creates set of VPC resources in Dev and Demo environment.

## STEPS TO RUN PULUMI

$ pulumi new aws-javascript
$ npm i
$ pulumi up
$ pulumi down

## REQUIREMENTS  

pulumi >= 3.88.0
aws >= 5.42.0

## MODULES

vpc_cidr_block
vpc_name
vpc_internet_gateway_name
vpc_public_subnet_name
vpc_public_route_name


## RESOURCES 

aws_vpc
aws_internet_gateway
aws_subnet
aws_route_table
aws_route_table_association


## AWS Custom VPC Creation steps:

1. Set the required region.
2. Create Virtual Private Cloud (VPC).
3. Create Internet Gateway.
4. Attach Internet gateway to the VPC.
5. Create Public Subnets.
6. Create Public route table.
7. Add public route to the public route table.
8. Associate the Public subnets with the Public Route table.
9. Create the Private subnets.
10. Create Private Route table.
11. Add public route to the public route table.
12. Associate the Private Subnets with the Private Route table.