import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule, makeHealthController, EventBus } from '@app/common';
import { EventController } from './event.controller';
import { EventStore } from './event.store';
import { EventEngine } from './event-engine';
import { SuspiciousActivityRule } from './rules/suspicious-activity.rule';
import { EventRule } from './rules/rule.interface';
import { PersonTrackRepository } from './tracking/person-track.repository';
import { TrackingService } from './tracking/tracking.service';
import { TrackingEngine } from './tracking/tracking.engine';
import { TrackingController } from './tracking/tracking.controller';
import { BehaviorSessionRepository } from './behavior/behavior-session.repository';
import { BehaviorService } from './behavior/behavior.service';
import { BehaviorEngine } from './behavior/behavior.engine';
import { BehaviorController } from './behavior/behavior.controller';
import { RiskScorer } from './behavior/risk-scorer';
import { PurchaseSessionRepository } from './purchase/purchase-session.repository';
import { PurchaseService } from './purchase/purchase.service';
import { PurchaseEngine } from './purchase/purchase.engine';
import { PurchaseController } from './purchase/purchase.controller';
import { PurchaseMatcher } from './purchase/purchase-matcher';
import { MockReceiptProvider } from './purchase/mock-receipt.provider';
import { RECEIPT_PROVIDER } from './purchase/receipt-provider.interface';
import { AlertDecisionRepository } from './alert/alert-decision.repository';
import { AlertService } from './alert/alert.service';
import { AlertEngine } from './alert/alert.engine';
import { AlertController } from './alert/alert.controller';
import { AlertPolicy } from './alert/alert-policy';

// Реестр правил движка. Добавить правило → реализовать EventRule и вписать сюда.
const RULES: EventRule[] = [new SuspiciousActivityRule()];

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [
    EventController,
    TrackingController,
    BehaviorController,
    PurchaseController,
    AlertController,
    makeHealthController('event'),
  ],
  providers: [
    EventStore,
    EventBus,
    EventEngine,
    { provide: 'EVENT_RULES', useValue: RULES },
    PersonTrackRepository,
    TrackingService,
    TrackingEngine,
    BehaviorSessionRepository,
    BehaviorService,
    BehaviorEngine,
    { provide: RiskScorer, useFactory: () => RiskScorer.fromEnv() },
    PurchaseSessionRepository,
    PurchaseService,
    PurchaseEngine,
    PurchaseMatcher,
    { provide: RECEIPT_PROVIDER, useClass: MockReceiptProvider },
    AlertDecisionRepository,
    AlertService,
    AlertEngine,
    { provide: AlertPolicy, useFactory: () => AlertPolicy.fromEnv() },
  ],
})
export class AppModule {}
