import 'dotenv/config';
import * as dns from 'node:dns';
import mongoose from 'mongoose';

// Payments captured before off-platform approval existed carry no
// `settlement`. This labels them so the payment checkpoints know how each one
// was confirmed:
//   - has a Stripe PaymentIntent id  -> STRIPE
//   - captured with none (marked paid by hand) -> LEGACY_MANUAL
// LEGACY_MANUAL rows keep counting, so cases already in flight do not lose
// their payment history. Run without --apply first to see what would change.
//
//   npx ts-node --transpile-only scripts/backfill-payment-settlement.ts
//   npx ts-node --transpile-only scripts/backfill-payment-settlement.ts --apply

if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));
}

const MONGODB_URI = process.env.MONGODB_URI;
const APPLY = process.argv.includes('--apply');

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Check apps/api/.env');
  process.exit(1);
}

async function main(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string);
  const payments = mongoose.connection.collection('payments');

  const unlabelled = {
    status: 'CAPTURED',
    settlement: { $exists: false },
    // Vendor payouts are not client money; leave them alone.
    direction: { $ne: 'CM_TO_VENDOR' },
  };

  const stripeBacked = await payments.countDocuments({
    ...unlabelled,
    stripePaymentIntentId: { $exists: true, $nin: [null, ''] },
  });
  const manual = await payments.countDocuments({
    ...unlabelled,
    $or: [
      { stripePaymentIntentId: { $exists: false } },
      { stripePaymentIntentId: null },
      { stripePaymentIntentId: '' },
    ],
  });

  console.log(`${APPLY ? 'Applying' : 'Dry run'}: ${stripeBacked} Stripe-backed, ${manual} manual.`);

  if (APPLY) {
    const a = await payments.updateMany(
      { ...unlabelled, stripePaymentIntentId: { $exists: true, $nin: [null, ''] } },
      { $set: { settlement: 'STRIPE' } },
    );
    const b = await payments.updateMany(
      {
        ...unlabelled,
        $or: [
          { stripePaymentIntentId: { $exists: false } },
          { stripePaymentIntentId: null },
          { stripePaymentIntentId: '' },
        ],
      },
      { $set: { settlement: 'LEGACY_MANUAL' } },
    );
    console.log(`Updated ${a.modifiedCount} as STRIPE, ${b.modifiedCount} as LEGACY_MANUAL.`);
  } else {
    console.log('Re-run with --apply to write these changes.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
