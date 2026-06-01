// Backend/services/complaint.queue.service.js
//
// RabbitMQ-based complaint queue.
// Complaints are NOT written to DB directly by the AI.
// They are published to a queue for human review.

const QUEUE_NAME = "customer_complaints";

let channel = null;
let connection = null;

// ─── Lazy Connection (connect on first use) ─────────────────────────────────

const getChannel = async () => {
  if (channel) return channel;

  const amqpUrl =
    process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";

  try {
    const amqplib = require("amqplib");
    connection = await amqplib.connect(amqpUrl);
    channel = await connection.createChannel();

    // Assert queue exists (durable = survives broker restart)
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    console.log(
      `[ComplaintQueue] Connected to RabbitMQ | Queue: ${QUEUE_NAME}`,
    );

    // Graceful shutdown
    process.once("SIGINT", async () => {
      await channel.close();
      await connection.close();
    });

    return channel;
  } catch (err) {
    console.error(
      `[ComplaintQueue] RabbitMQ connection failed: ${err.message}`,
    );
    console.error(
      `[ComplaintQueue] Complaints will be logged to console as fallback.`,
    );
    return null;
  }
};

// ─── Publish Complaint ──────────────────────────────────────────────────────

const publishComplaint = async (complaintData) => {
  const message = {
    ...complaintData,
    id: `CMP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    status: "PENDING_REVIEW",
  };

  const ch = await getChannel();

  if (ch) {
    // RabbitMQ is available — publish to queue
    const buffer = Buffer.from(JSON.stringify(message));
    ch.sendToQueue(QUEUE_NAME, buffer, { persistent: true });

    console.log(
      `[ComplaintQueue] Published complaint ${message.id} for user ${complaintData.userId}`,
    );
  } else {
    // Fallback: log to console (RabbitMQ not available)
    console.warn(
      `[ComplaintQueue] FALLBACK — Complaint logged to console:`,
      JSON.stringify(message, null, 2),
    );
  }

  return {
    success: true,
    complaintId: message.id,
    message:
      "Phiếu khiếu nại của bạn đã được ghi nhận. Bộ phận hỗ trợ sẽ xử lý trong vòng 24 giờ. Mã phiếu: " +
      message.id,
  };
};

// ─── Consume Complaints (for Admin Worker) ──────────────────────────────────
// This can be run in a separate process to handle complaints

const consumeComplaints = async (handler) => {
  const ch = await getChannel();
  if (!ch) {
    throw new Error("Cannot consume: RabbitMQ not available");
  }

  console.log(
    `[ComplaintQueue] Waiting for complaints on queue: ${QUEUE_NAME}`,
  );

  ch.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    try {
      const complaint = JSON.parse(msg.content.toString());
      console.log(`[ComplaintQueue] Processing complaint ${complaint.id}...`);

      await handler(complaint);

      ch.ack(msg);
      console.log(`[ComplaintQueue] Complaint ${complaint.id} processed.`);
    } catch (err) {
      console.error(`[ComplaintQueue] Handler error:`, err.message);
      // Requeue on failure
      ch.nack(msg, false, true);
    }
  });
};

module.exports = {
  publishComplaint,
  consumeComplaints,
};
