const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    barcode: { type: String, required: false }, // Optional barcode (null when not provided)
    costPrice: { type: Number, required: true },
    salePrice: { type: Number, required: true },
    discount: { type: Number, default: 0 }, // Product-wise discount
    vendor: { type: String },
    category: { type: String },
    image: { type: String }, // Path or URL to image
    description: { type: String },
    // Piece/Box logic
    hasPieces: { type: Boolean, default: false },
    piecesPerBox: { type: Number, default: 1 },
    pieceCostPrice: { type: Number, default: 0 },
    pieceSalePrice: { type: Number, default: 0 },
    unitName: { type: String, default: "Box" },
    pieceName: { type: String, default: "Piece" },

    // For simplicity, we can track total stock here, (Stored as total units/pieces if hasPieces is true)
    // but we'll also use an Inventory model for warehouse-specific tracking
    totalStock: { type: Number, default: 0 },
    // Critical stock threshold - notifications trigger when stock falls below this
    criticalThreshold: { type: Number, default: 10 },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
  },
  { timestamps: true },
);

// No automatic index on barcode - we handle uniqueness in controller
// This allows unlimited products without barcodes

module.exports = mongoose.model("Product", productSchema);
