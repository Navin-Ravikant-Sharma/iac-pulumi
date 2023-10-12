# iac-pulumi

## INTRODUCTION

Configuration creates set of VPC resources in Dev and Demo environment.

## STEPS TO RUN PULUMI

1. $ pulumi new aws-javascript
2. $ npm i
3. $ pulumi up
4. $ pulumi down

## REQUIREMENTS  

1. pulumi >= 3.88.0
2. aws >= 5.42.0

## MODULES

1. vpc_cidr_block
2. vpc_name
3. vpc_internet_gateway_name
4. vpc_public_subnet_name
5. vpc_public_route_name


## RESOURCES 

1. aws_vpc
2. aws_internet_gateway
3. aws_subnet
4. aws_route_table
5. aws_route_table_association


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