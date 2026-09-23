import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CaseEvents } from '../../common/events/case-events';

@Injectable()
export class TasksListener {
  private readonly logger = new Logger(TasksListener.name);

  @OnEvent(CaseEvents.HOLD_RELEASED)
  onHoldReleased(payload: { caseId: string; metadata?: Record<string, unknown> }): void {
    this.logger.log(
      `[event:case.hold.released] case=${payload.caseId} meta=${JSON.stringify(payload.metadata ?? {})}`,
    );
  }
}
