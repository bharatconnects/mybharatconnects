import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { Vendor, VendorSchema } from './schemas/vendor.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vendor.name, schema: VendorSchema },
      // Read-only here: registering a vendor profile checks the user exists
      // and has the VENDOR role, and the admin list needs vendor accounts
      // that have no profile yet.
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [VendorsController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
