const Product = require("../models/Product");
const Inventory = require("../models/Inventory");
const Warehouse = require("../models/Warehouse");
const { syncProductTotalStock } = require("./inventoryController");

// Helper: get active store
const getActiveStore = (req) => {
  return req.user?.store || req.headers["x-store-id"];
};

// ===================== GET ALL PRODUCTS =====================
const getProducts = async (req, res) => {
  try {
    const { allStores, storeId: queryStoreId } = req.query;
    
    // Use query param storeId if provided, otherwise use active store
    const storeId = queryStoreId || getActiveStore(req);
    
    if (!storeId && allStores !== "true") {
      return res.status(400).json({ message: "Store context required" });
    }

    const query = allStores === "true" ? {} : { store: storeId };

    const products = await Product.find(query).populate("store", "name");
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===================== GET PRODUCT BY ID =====================
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ===================== CREATE PRODUCT =====================
const createProduct = async (req, res) => {
  const {
    name,
    barcode,
    costPrice,
    salePrice,
    discount,
    totalStock,
    stock,
    category,
    vendor,
    description,
    warehouseId,
    hasPieces,
    piecesPerBox,
    pieceCostPrice,
    pieceSalePrice,
    unitName,
    pieceName,
  } = req.body;

  const initialStock = Number(totalStock) || Number(stock) || 0;

  try {
    const storeId = getActiveStore(req);
    if (!storeId) {
      return res.status(400).json({ message: "Store context required" });
    }

    // Check duplicate barcode ONLY if barcode exists
    if (barcode && barcode.trim() !== "") {
      const exists = await Product.findOne({
        barcode: barcode.trim(),
        store: storeId,
      });
      if (exists) {
        return res
          .status(400)
          .json({
            message: "Product with this barcode already exists in this store",
          });
      }
    }

    // Build product object (IMPORTANT)
    const productData = {
      name,
      costPrice: Number(costPrice),
      salePrice: Number(salePrice),
      discount: Number(discount) || 0,
      totalStock: initialStock, // Save the stock value
      category,
      vendor,
      description,
      store: storeId,
      image: req.file ? `/uploads/${req.file.filename}` : undefined,
      hasPieces: hasPieces === "true" || hasPieces === true,
      piecesPerBox: Math.max(1, Number(piecesPerBox) || 1),
      pieceCostPrice: Number(pieceCostPrice) || 0,
      pieceSalePrice: Number(pieceSalePrice) || 0,
      unitName: unitName || 'Box',
      pieceName: pieceName || 'Piece',
    };

    // ONLY add barcode if provided
    if (barcode && barcode.trim() !== "") {
      productData.barcode = barcode.trim();
    }

    const product = new Product(productData);
    const createdProduct = await product.save();

    // ===== INVENTORY =====
    // ONLY create inventory if both stock AND warehouse are provided
    if (initialStock > 0 && warehouseId) {
      console.log('Creating inventory - Product:', createdProduct._id, 'Warehouse:', warehouseId, 'Stock:', initialStock);
      await Inventory.create({
        product: createdProduct._id,
        warehouse: warehouseId,
        quantity: Number(initialStock),
      });
      console.log('Inventory created successfully!');
      
      await syncProductTotalStock(createdProduct._id);
    } else if (initialStock > 0 && !warehouseId) {
      console.log('Stock provided but no warehouse - inventory NOT created');
    }

    res.status(201).json(createdProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ===================== UPDATE PRODUCT =====================
const updateProduct = async (req, res) => {
  const {
    name,
    barcode,
    costPrice,
    salePrice,
    discount,
    totalStock,
    category,
    vendor,
    description,
    hasPieces,
    piecesPerBox,
    pieceCostPrice,
    pieceSalePrice,
    unitName,
    pieceName,
  } = req.body;

  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check barcode conflict ONLY if changed and exists
    if (
      barcode &&
      barcode.trim() !== "" &&
      barcode.trim() !== product.barcode
    ) {
      const exists = await Product.findOne({
        barcode: barcode.trim(),
        store: product.store,
        _id: { $ne: product._id },
      });

      if (exists) {
        return res.status(400).json({ message: "Barcode already in use" });
      }
    }

    product.name = name ?? product.name;
    product.costPrice =
      costPrice !== undefined ? Number(costPrice) : product.costPrice;
    product.salePrice =
      salePrice !== undefined ? Number(salePrice) : product.salePrice;
    product.discount =
      discount !== undefined ? Number(discount) : product.discount;
    product.totalStock =
      totalStock !== undefined ? Number(totalStock) : product.totalStock;
    product.category = category ?? product.category;
    product.vendor = vendor ?? product.vendor;
    product.description = description ?? product.description;
    product.hasPieces = hasPieces !== undefined ? (hasPieces === "true" || hasPieces === true) : product.hasPieces;
    product.piecesPerBox = piecesPerBox !== undefined ? Math.max(1, Number(piecesPerBox)) : product.piecesPerBox;
    product.pieceCostPrice = pieceCostPrice !== undefined ? Number(pieceCostPrice) : product.pieceCostPrice;
    product.pieceSalePrice = pieceSalePrice !== undefined ? Number(pieceSalePrice) : product.pieceSalePrice;
    product.unitName = unitName ?? product.unitName;
    product.pieceName = pieceName ?? product.pieceName;

    // Barcode handling (IMPORTANT)
    if (barcode !== undefined) {
      if (barcode.trim() === "") {
        product.barcode = undefined; // REMOVE field
      } else {
        product.barcode = barcode.trim();
      }
    }

    if (req.file) {
      product.image = `/uploads/${req.file.filename}`;
    }

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===================== DELETE PRODUCT =====================
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await product.deleteOne();
    res.json({ message: "Product removed" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
