import { Construct } from "constructs";
import { Period, RestApi } from "aws-cdk-lib/aws-apigateway";

export class ApigwConstruct extends Construct {
  public readonly apiGw: RestApi;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.apiGw = new RestApi(this, `${id}-REST`);
    const apiKey = this.apiGw.addApiKey(`${id}-key`);
    const usagePlan = this.apiGw.addUsagePlan(`${id}-usage-plan`, {
      apiStages: [
        {
          api: this.apiGw,
          stage: this.apiGw.deploymentStage,
        },
      ],
      quota: { limit: 1000, period: Period.DAY },
    });
    usagePlan.addApiKey(apiKey);
  }
}
