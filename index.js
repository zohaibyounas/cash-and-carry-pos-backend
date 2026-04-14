const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:3000", "https://client-pos-frontend.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-store-id"],
    credentials: true,
  })
);
app.use(express.json());

// Basic Route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/stores", require("./routes/storeRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/warehouses", require("./routes/warehouseRoutes"));
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/sales", require("./routes/saleRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));
app.use("/api/expenses", require("./routes/expenseRoutes"));
app.use("/api/purchases", require("./routes/purchaseRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/retailers", require("./routes/retailerRoutes"));
app.use("/api/employees", require("./routes/employeeRoutes"));
app.use("/api/attendance", require("./routes/attendanceRoutes"));
app.use("/api/banks", require("./routes/bankRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));

// Static files for product images
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Database Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
