import { App } from "aws-cdk-lib";
import { FoundationStack } from "./services/foundation-stack/foundation.stack";
import { OrderOrchestratorStack } from "./services/order-orchestrator/order-orchestrator.stack";
import { BarmanApiStack } from "./services/barman-api/barman-api.stack";
import { CustomerApiStack } from "./services/customer-api/customer-api.stack";
import { NotificationServiceStack } from "./services/notification-service/notification-service.stack";

const app = new App();

// Foundation stack with DynamoDB, EventBridge, Cognito
const foundation = new FoundationStack(app, "FoundationStack");

// Order orchestrator (Lambda Durable Function)
const orchestrator = new OrderOrchestratorStack(app, "OrderOrchestratorStack", {
  table: foundation.table,
  eventBus: foundation.eventBus,
});

// Customer API (for mobile app)
new CustomerApiStack(app, "CustomerApiStack", {
  table: foundation.table,
  orchestratorLambda: orchestrator.orchestratorAlias,
  orchestratorQualifiedArn: orchestrator.orchestratorAlias.functionArn,
});

// Barman API (for barman dashboard)
new BarmanApiStack(app, "BarmanApiStack", {
  table: foundation.table,
});

// Notification service (EventBridge → IoT Core)
new NotificationServiceStack(app, "NotificationServiceStack", {
  eventBus: foundation.eventBus,
});

app.synth();
