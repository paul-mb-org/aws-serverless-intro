import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { EventBus } from "aws-cdk-lib/aws-events";
import {
  AccountRecovery,
  CfnIdentityPool,
  CfnIdentityPoolRoleAttachment,
  UserPool,
  UserPoolClient,
} from "aws-cdk-lib/aws-cognito";
import { Effect, FederatedPrincipal, PolicyStatement, Role } from "aws-cdk-lib/aws-iam";

export class FoundationStack extends Stack {
  public readonly table: Table;
  public readonly eventBus: EventBus;
  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;
  public readonly identityPool: CfnIdentityPool;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.table = new Table(this, "BarmanTbl", {
      partitionKey: {
        name: "pk",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: {
        name: "GSI1PK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "GSI1SK",
        type: AttributeType.STRING,
      },
    });

    this.eventBus = new EventBus(this, "BarmanEventBus");

    this.userPool = new UserPool(this, "BarmanUserPool", {
      selfSignUpEnabled: true,
      signInAliases: { email: true, username: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: false, mutable: true } },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.userPoolClient = this.userPool.addClient("BarmanUserPoolClient", {
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      generateSecret: false,
    });

    this.identityPool = new CfnIdentityPool(this, "BarmanIdentityPool", {
      allowUnauthenticatedIdentities: true,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
        },
      ],
    });

    const guestsRole = new Role(this, "BarmanGuestsRole", {
      assumedBy: new FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: { "cognito-identity.amazonaws.com:aud": this.identityPool.ref },
          "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "unauthenticated" },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
    });

    const authenticatedRole = new Role(this, "AuthenticatedRole", {
      assumedBy: new FederatedPrincipal(
        "cognito-identity.amazonaws.com",
        {
          StringEquals: { "cognito-identity.amazonaws.com:aud": this.identityPool.ref },
          "ForAnyValue:StringLike": { "cognito-identity.amazonaws.com:amr": "authenticated" },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
    });

    const iotPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["iot:Connect", "iot:Publish", "iot:Subscribe", "iot:Receive"],
      resources: ["*"],
    });

    const apiPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["execute-api:Invoke"],
      resources: ["arn:aws:execute-api:*:*:*"], //simplicity
    });

    guestsRole.addToPolicy(iotPolicy);
    authenticatedRole.addToPolicy(iotPolicy);
    authenticatedRole.addToPolicy(apiPolicy);
    guestsRole.addToPolicy(apiPolicy);

    new CfnIdentityPoolRoleAttachment(this, "BarmanIdentityPoolRoleAttachment", {
      identityPoolId: this.identityPool.ref,
      roles: { authenticated: authenticatedRole.roleArn, unauthenticated: guestsRole.roleArn },
      roleMappings: {
        cognito: {
          ambiguousRoleResolution: "AuthenticatedRole",
          type: "Token",
          identityProvider: `${this.userPool.userPoolProviderName}:${this.userPoolClient.userPoolClientId}`,
        },
      },
    });
  }
}
