import mongoose from "mongoose";

const legalDocumentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["terms_and_conditions", "privacy_policy"],
      required: true,
    },
    version: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    effectiveDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const LegalDocument = mongoose.model("LegalDocument", legalDocumentSchema);

export default LegalDocument;
