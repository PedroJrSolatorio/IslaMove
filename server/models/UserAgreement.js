import mongoose from "mongoose";

const userAgreementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  documentType: {
    type: String,
    enum: ["terms_and_conditions", "privacy_policy"],
    required: true,
  },
  documentVersion: {
    type: String,
    required: true,
  },
  agreedAt: {
    type: Date,
    default: Date.now,
  },
  ipAddress: String,
  userAgent: String,
});

const UserAgreement = mongoose.model("UserAgreement", userAgreementSchema);

export default UserAgreement;
