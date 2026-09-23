import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';
import { Property, PropertySchema } from './schemas/property.schema';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import { RentPayment, RentPaymentSchema } from './schemas/rent-payment.schema';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from './schemas/maintenance-ticket.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: RentPayment.name, schema: RentPaymentSchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
    ]),
  ],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {}
