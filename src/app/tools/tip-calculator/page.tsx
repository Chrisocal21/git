'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

const QUICK_TIPS = [10, 15, 18, 20, 25]

export default function TipCalculatorPage() {
  const router = useRouter()

  const [billText, setBillText] = useState('')
  const [tipPercent, setTipPercent] = useState(18)
  const [customTip, setCustomTip] = useState('')
  const [people, setPeople] = useState(1)

  const bill = parseFloat(billText) || 0
  const effectiveTipPercent = customTip !== '' ? (parseFloat(customTip) || 0) : tipPercent

  const { tipAmount, total, perPerson, tipPerPerson, totalPerPerson } = useMemo(() => {
    const tipAmount = bill * (effectiveTipPercent / 100)
    const total = bill + tipAmount
    const safePeople = Math.max(1, people)
    return {
      tipAmount,
      total,
      perPerson: total / safePeople,
      tipPerPerson: tipAmount / safePeople,
      totalPerPerson: total / safePeople,
    }
  }, [bill, effectiveTipPercent, people])

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#3A6B86] to-[#2F5F7F] p-6 pb-8">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => router.back()}
            className="mb-4 text-white/70 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-[#E8B44D] mb-2">Tip Calculator</h1>
          <p className="text-white/80 text-sm">Split the bill and figure out the tip.</p>
        </div>
      </div>

      <div className="p-6 max-w-md mx-auto space-y-5">
        {/* Bill amount */}
        <div>
          <label className="block text-xs text-white/50 mb-1.5">Bill Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-lg">$</span>
            <input
              inputMode="decimal"
              value={billText}
              onChange={e => {
                const v = e.target.value
                if (/^\d*\.?\d{0,2}$/.test(v)) setBillText(v)
              }}
              placeholder="0.00"
              className="w-full pl-8 pr-3 py-3 bg-[#1a1a1a] border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2a7b9b] text-2xl font-semibold"
            />
          </div>
        </div>

        {/* Tip percent */}
        <div>
          <label className="block text-xs text-white/50 mb-1.5">Tip %</label>
          <div className="grid grid-cols-5 gap-2">
            {QUICK_TIPS.map(pct => (
              <button
                key={pct}
                onClick={() => { setTipPercent(pct); setCustomTip('') }}
                className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  customTip === '' && tipPercent === pct
                    ? 'bg-[#E8B44D] text-black'
                    : 'bg-[#1a1a1a] text-white/70 hover:bg-white/10'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
          <input
            inputMode="decimal"
            value={customTip}
            onChange={e => {
              const v = e.target.value
              if (/^\d*\.?\d{0,2}$/.test(v)) setCustomTip(v)
            }}
            placeholder="Custom %"
            className="w-full mt-2 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a7b9b] text-sm"
          />
        </div>

        {/* Split */}
        <div>
          <label className="block text-xs text-white/50 mb-1.5">Split Between</label>
          <div className="flex items-center gap-3 bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2">
            <button
              onClick={() => setPeople(p => Math.max(1, p - 1))}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white text-lg transition-colors"
            >
              −
            </button>
            <div className="flex-1 text-center">
              <span className="text-lg font-semibold">{people}</span>
              <span className="text-xs text-white/40 ml-1">{people === 1 ? 'person' : 'people'}</span>
            </div>
            <button
              onClick={() => setPeople(p => p + 1)}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white text-lg transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="bg-gradient-to-br from-[#2F5F7F]/30 to-[#1a3a4d]/30 rounded-xl border border-[#E8B44D]/10 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">Tip Amount</span>
            <span className="text-lg font-semibold text-white">{fmt(tipAmount)}</span>
          </div>
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-white/60 text-sm">Total</span>
            <span className="text-2xl font-bold text-[#E8B44D]">{fmt(total)}</span>
          </div>

          {people > 1 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">Tip / Person</span>
                <span className="text-sm font-medium text-white">{fmt(tipPerPerson)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">Total / Person</span>
                <span className="text-lg font-semibold text-[#E8B44D]">{fmt(totalPerPerson)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
