export function formatCurrency(value: number | undefined): string {
  if (typeof value !== "number" || isNaN(value)) return "₹0.00";

  // Handle large abbreviations
  if (value >= 1e12) {
    return `₹${(value / 1e12).toFixed(2)} LCr`; // Lakh Crore
  }
  if (value >= 1e7) {
    return `₹${(value / 1e7).toFixed(2)} Cr`; // Crore
  }

  // Format with Indian numbering system and ₹ symbol for smaller numbers
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatVolume(value: number | undefined): string {
  if (typeof value !== "number" || isNaN(value)) return "0";

  if (value >= 1e7) {
    return `${(value / 1e7).toFixed(2)} Cr`; // Crore
  }
  if (value >= 1e5) {
    return `${(value / 1e5).toFixed(2)} L`; // Lakh
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(2)} K`; // Thousands
  }

  return new Intl.NumberFormat("en-IN").format(value);
}
