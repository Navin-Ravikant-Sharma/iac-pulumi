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
        const pubsubnet = new aws.ec2.Subnet(config.config['iacpulumi:publicSubnet'] + i, {
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
        const privsubnet = new aws.ec2.Subnet(config.config['iacpulumi:privateSubnet'] + i, {
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
        const routeTable = new aws.ec2.RouteTableAssociation(config.config['iacpulumi:publicRoute'] + `${index}`, {
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
        const routeTable = new aws.ec2.RouteTableAssociation(config.config['iacpulumi:privateRoute'] + `${index}`, {
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

    const lbSecurityGroup = new aws.ec2.SecurityGroup('loadBalancerSecurityGroup', {
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
        ],
        egress: [
            {
                protocol: config.config['iacpulumi:RestrictedProtocol'],
                fromPort: config.config['iacpulumi:Restricted_Port'],
                toPort: config.config['iacpulumi:Restricted_Port'],
                cidrBlocks: [config.config['iacpulumi:destination_cidr']],
            },
        ],
        tags: {
            Name: config.config['iacpulumi:lbSecurityGroup'],
        }
    });

    const securityGroup = new aws.ec2.SecurityGroup(config.config['iacpulumi:SecurityGroup'], {
        vpcId: myvpc.id,
        ingress: [
            {
                protocol: config.config['iacpulumi:Protocol'],
                fromPort: config.config['iacpulumi:webapp_Port'],
                toPort: config.config['iacpulumi:webapp_Port'],
                ipv6_cidr_blocks: [config.config['iacpulumi:ipv6']],
                securityGroups: [lbSecurityGroup.id],
            },
            {
                protocol: config.config['iacpulumi:Protocol'],
                fromPort: config.config['iacpulumi:SSHPort'],
                toPort: config.config['iacpulumi:SSHPort'],
                securityGroups: [lbSecurityGroup.id],
            },
        ],
        egress: [
            {
                protocol: config.config['iacpulumi:RestrictedProtocol'],
                fromPort: config.config['iacpulumi:Restricted_Port'],
                toPort: config.config['iacpulumi:Restricted_Port'],
                cidrBlocks: [config.config['iacpulumi:destination_cidr']],
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
        family: config.config['iacpulumi:parameterGroupFamily'],
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
        vpcSecurityGroupIds: [securityGroupRDS.id],
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

    const env_file = config.config['iacpulumi:envfile'];

    RDS_Instance.endpoint.apply(endpoint => {
        const IAMRole = new aws.iam.Role(config.config['iacpulumi:IAMRoleName'], {
            assumeRolePolicy: JSON.stringify({
                Version: config.config['iacpulumi:IAMVersion'],
                Statement: [
                    {
                        Action: config.config['iacpulumi:Action'],
                        Effect: config.config['iacpulumi:Effect'],
                        Principal: {
                            Service: config.config['iacpulumi:Service'],
                        },
                    },
                ],
            })
        })

        const policy = new aws.iam.PolicyAttachment(config.config['iacpulumi:PolicyAttachmentName'], {
            policyArn: config.config['iacpulumi:PolicyARN'],
            roles: [IAMRole.name],
        });

        const roleAttachment = new aws.iam.InstanceProfile(config.config['iacpulumi:InstanceProfileName'], {
            role: IAMRole.name,
        });

        let launchConfig = new aws.ec2.LaunchTemplate(config.config['iacpulumi:LaunchTemplateName'], {
            imageId: ami.then(i => i.id),
            instanceType: config.config['iacpulumi:instanceType'],
            keyName: config.config['iacpulumi:keyValue'],
            networkInterfaces: [{
                associatePublicIpAddress: config.config['iacpulumi:associatePublicIpAddress'],
                securityGroups: [securityGroup.id],
            }],
            ebsBlockDevices: [
                {
                    deviceName: config.config['iacpulumi:EC2_DEVICE_NAME'],
                    deleteOnTermination: config.config['iacpulumi:EC2_DELETE_ON_TERMINATION'],
                    volumeSize: config.config['iacpulumi:EC2_VOLUME_SIZE'],
                    volumeType: config.config['iacpulumi:EC2_VOLUME_TYPE']
                }
            ],
            iamInstanceProfile: { name: roleAttachment.name },
            userData: Buffer.from(`#!/bin/bash
                echo "host=${endpoint}" >> ${env_file}
                echo "user=${config.config['iacpulumi:user']}" >> ${env_file}
                echo "pd=${config.config['iacpulumi:pd']}" >> ${env_file}
                echo "port=${config.config['iacpulumi:port']}" >> ${env_file}
                echo "dialect=${config.config['iacpulumi:dialect']}" >> ${env_file}
                echo "database=${config.config['iacpulumi:database']}" >> ${env_file}
                echo "statsdPort=${config.config['iacpulumi:satsdport']}" >> ${env_file}
                echo "statsdhost=${config.config['iacpulumi:statsdhost']}" >> ${env_file}
                sudo systemctl restart amazon-cloudwatch-agent
            `).toString('base64'),
        });

        const targetGroup = new aws.lb.TargetGroup(config.config['iacpulumi:targetGroupName'], {
            port: config.config['iacpulumi:port'],
            protocol: config.config['iacpulumi:targetGroupProtocol'],
            targetType: config.config['iacpulumi:targetType'],
            vpcId: myvpc.id,
            healthCheck: {
                path: config.config['iacpulumi:healthCheckPath'],
                interval: config.config['iacpulumi:interval'],
                timeout: config.config['iacpulumi:timeout'],
                healthyThreshold: config.config['iacpulumi:healthyThreshold'],
                unhealthyThreshold: config.config['iacpulumi:unhealthyThreshold'],
                matcher: config.config['iacpulumi:matcher'],
            },
        });

        const autoScalingGroup = new aws.autoscaling.Group(config.config['iacpulumi:autoscalingGroup'], {
            vpcZoneIdentifiers: publicSubnets,
            desiredCapacity: config.config['iacpulumi:desiredCapacity'],
            targetGroupArns: [targetGroup.arn],
            minSize: config.config['iacpulumi:minSize'],
            maxSize: config.config['iacpulumi:maxSize'],
            launchTemplate: {
                id: launchConfig.id,
            },
        });

        const scaleUp = new aws.autoscaling.Policy(config.config['iacpulumi:scaleUpPolicy'], {
            cooldown: config.config['iacpulumi:cooldown'],
            scalingAdjustment: config.config['iacpulumi:scalingAdjustment'],
            adjustmentType: config.config['iacpulumi:adjustmentType'],
            policyType: config.config['iacpulumi:policyType'],
            autoscalingGroupName: autoScalingGroup.name,
        });

        const scaleUpCondition = new aws.cloudwatch.MetricAlarm(config.config['iacpulumi:scaleUpConditionName'], {
            metricName: config.config['iacpulumi:metricName'],
            namespace: config.config['iacpulumi:namespace'],
            statistic: config.config['iacpulumi:statistic'],
            period: config.config['iacpulumi:period'],
            evaluationPeriods: config.config['iacpulumi:evaluationPeriods'],
            comparisonOperator: config.config['iacpulumi:comparisonOperator'],
            dimensions: {
                AutoScalingGroupName: autoScalingGroup.name,
            },
            threshold: config.config['iacpulumi:Upthreshold'],
            alarmActions: [scaleUp.arn],
        });

        const scaleDown = new aws.autoscaling.Policy("scale_down_policy", {
            cooldown: config.config['iacpulumi:cooldown'],
            scalingAdjustment: config.config['iacpulumi:scalingAdjustmentDown'],
            adjustmentType: config.config['iacpulumi:adjustmentType'],
            policyType: config.config['iacpulumi:policyType'],
            autoscalingGroupName: autoScalingGroup.name,
        });

        const scaleDownCondition = new aws.cloudwatch.MetricAlarm("scaleDownCondition", {
            metricName: config.config['iacpulumi:metricName'],
            namespace: config.config['iacpulumi:namespace'],
            statistic: config.config['iacpulumi:statistic'],
            period: config.config['iacpulumi:period'],
            evaluationPeriods: config.config['iacpulumi:evaluationPeriods'],
            comparisonOperator: config.config['iacpulumi:comparisonOperatorLesser'],
            threshold: config.config['iacpulumi:Downthreshold'],
            dimensions: {
                AutoScalingGroupName: autoScalingGroup.name,
            },
            alarmActions: [scaleDown.arn],
        });

        const loadBalancer = new aws.lb.LoadBalancer(config.config['iacpulumi:LoadBalancerName'], {
            loadBalancerType: config.config['iacpulumi:loadBalancerType'],
            subnets: publicSubnets,
            securityGroups: [lbSecurityGroup.id],
        });

        const listener = new aws.lb.Listener(config.config['iacpulumi:Listner'], {
            loadBalancerArn: loadBalancer.arn,
            port: config.config['iacpulumi:HTTP_Port'],
            protocol: config.config['iacpulumi:targetGroupProtocol'],
            defaultActions: [{
                type: config.config['iacpulumi:defaultActionsType'],
                targetGroupArn: targetGroup.arn,
            }],
        });

        const hostedZone = aws.route53.getZone({ name: config.config['iacpulumi:DomainName'] });
        const route53Record = new aws.route53.Record(config.config['iacpulumi:Route53'], {
            name: config.config['iacpulumi:DomainName'],
            zoneId: hostedZone.then(zone => zone.zoneId),
            type: config.config['iacpulumi:Route53Type'],
            aliases: [
                {
                    name: loadBalancer.dnsName,
                    zoneId: loadBalancer.zoneId,
                    evaluateTargetHealth: config.config['iacpulumi:associatePublicIpAddress'],
                },
            ],
        });
    });
});