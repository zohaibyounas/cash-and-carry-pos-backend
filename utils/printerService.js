const axios = require("axios");
const Warehouse = require("../models/Warehouse");

/**
 * Sends a receipt to an IoT printer.
 * @param {Object} store The store object containing printerEndpoint.
 * @param {Object} sale The full sale object.
 * @param {Array} items Items belonging specifically to this store.
 * @param {Boolean} hidePrices Whether to hide prices (for warehouse receipts).
 */
const sendToPrinter = async (store, sale, items, hidePrices = false) => {
  if (!store.printerEnabled || !store.printerEndpoint) {
    console.log(
      `Printing skipped for store ${store.name}: Printer not configured.`,
    );
    return;
  }

  try {
    const payload = {
      invoiceId: sale.invoiceId,
      customerName: sale.customerName || "Walk-in Customer",
      customerPhone: sale.customerPhone || "",
      date: sale.saleDate || sale.createdAt,
      // Include store contact details (fallback to provided values)
      storeName: store.name,
      storePhone: store.contactNumber || "03091009866",
      storeAddress:
        store.location || "Street 10, Block C, Sector 4, APHS Rawalpindi",
      // Printing controls for the IoT printer
      hidePrices: hidePrices,
      hideRemarks: true,
      hideSignatures: true,
      barcodeFontSize: 18,
      autoCut: true,
      trailerLines: 5,
      items: items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        price: hidePrices ? null : item.price,
        total: hidePrices ? null : item.total,
        barcode: item.product.barcode || "",
      })),
      storeTotal: hidePrices
        ? null
        : items.reduce((sum, item) => sum + item.total, 0),
    };

    console.log(
      `Sending print request to ${store.printerEndpoint} for store ${store.name} (hidePrices: ${hidePrices})`,
    );
    const response = await axios.post(store.printerEndpoint, payload, {
      timeout: 5000,
    });
    console.log(`Printer response for ${store.name}:`, response.status);
  } catch (error) {
    console.error(`Failed to print for store ${store.name}:`, error.message);
  }
};

/**
 * Sends warehouse receipt to printer (without prices)
 * @param {Object} warehouse The warehouse object.
 * @param {Object} sale The full sale object.
 * @param {Array} items Items belonging to this warehouse.
 */
const sendWarehouseReceipt = async (warehouse, sale, items) => {
  if (!warehouse || !warehouse.printerEndpoint) {
    console.log(`Warehouse printing skipped: Printer not configured.`);
    return;
  }

  try {
    const payload = {
      invoiceId: sale.invoiceId,
      customerName: sale.customerName || "Walk-in Customer",
      customerPhone: sale.customerPhone || "",
      customerAddress: sale.customerAddress || "",
      date: sale.saleDate || sale.createdAt,
      warehouseName: warehouse.name,
      warehousePhone: warehouse.phone || warehouse.contact || "03091009866",
      warehouseAddress:
        warehouse.location || "Street 10, Block C, Sector 4, APHS Rawalpindi",
      // Printing controls
      hidePrices: true, // Always hide prices for warehouse receipts
      hideRemarks: true,
      hideSignatures: true,
      barcodeFontSize: 18,
      autoCut: true,
      trailerLines: 5,
      items: items.map((item) => ({
        name: item.product.name,
        barcode: item.product.barcode || "",
        quantity: item.quantity,
      })),
    };

    console.log(
      `Sending warehouse receipt to ${warehouse.printerEndpoint} for warehouse ${warehouse.name}`,
    );
    const response = await axios.post(warehouse.printerEndpoint, payload, {
      timeout: 5000,
    });
    console.log(
      `Warehouse printer response for ${warehouse.name}:`,
      response.status,
    );
  } catch (error) {
    console.error(
      `Failed to print warehouse receipt for ${warehouse.name}:`,
      error.message,
    );
  }
};

module.exports = { sendToPrinter, sendWarehouseReceipt };
