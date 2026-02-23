# Waste/Loss Tracking - Feature Guide

## ✅ What's New (Feb 22, 2026)

Track damaged, lost, or wasted materials directly on each product in your job!

## 🎯 Features

### Real-Time Waste Tracking
- **+/- Controls:** Quick buttons to adjust waste count for each product
- **Visual Feedback:** See waste count, total quantity, and items remaining at a glance
- **Smart Limits:** Can't waste more than you have or go below zero

### Summary Dashboard
At the top of the Products section, see:
- **Total:** All items across all products
- **Wasted:** Total items lost/damaged
- **Available:** Items still usable (Total - Wasted)

### Job Summary Integration
The Job Summary card now shows:
- Total product count
- Total waste count
- Per-product breakdown with waste details

## 🚀 How to Use

1. Go to any job (fldr)
2. Add or open the **Products** section
3. For each product, use the **+** and **-** buttons in the "Waste" row
4. See live updates in the summary stats at the top
5. Check the Job Summary card to see overall waste impact

## 💡 Use Cases

- **Material Loss:** Track items damaged during setup/teardown
- **Quality Control:** Log defective products you can't use
- **Inventory Accuracy:** Know exactly what's available vs. what you brought
- **Cost Tracking:** Document waste for client billing or internal reports

## 📊 Data Structure

Each product now has:
```typescript
{
  id: string
  name: string
  quantity: number      // Total items you have
  waste: number        // Items lost/damaged (NEW!)
  notes: string | null
}
```

**Available = Quantity - Waste**

## 🔄 Backward Compatibility

- Existing products automatically get `waste: 0`
- Old data loads without issues
- Duplicated jobs reset waste to 0 (fresh start for new job)

## 🎨 UI Elements

- **+/- Buttons:** Gray boxes with hover effect
- **Waste Counter:** Red text showing items wasted
- **Available Counter:** Green badge showing usable items
- **Summary Stats:** Gradient card with 3 columns (Total/Wasted/Available)

---

**Status:** ✅ Shipped & Ready  
**Time to Build:** ~45 minutes  
**Files Changed:** 2 (fldr.ts, page.tsx)
