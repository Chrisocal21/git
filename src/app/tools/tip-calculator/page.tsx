'use client'

import { useMemo, useState } from 'react'
import PageHeader from '@/components/PageHeader'

const QUICK_TIPS = [10, 15, 18, 20, 25]

export default function TipCalculatorPage() {
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
    <div className="min-h-page text-white">
      <PageHeader title="Tip Calculator" subtitle="Split the bill and figure out the tip." width="max-w-md" />

      <div className="px-4 py-6 max-w-md mx-auto space-y-5">
        {/* Bill amount */}
        <div>
          <label htmlFor="bill" className="label">Bill Amount</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-lg">$</span>
            <input
              id="bill"
              inputMode="decimal"
              value={billText}
              onChange={e => {
                const v = e.target.value
                if (/^\d*\.?\d{0,2}$/.test(v)) setBillText(v)
              }}
              placeholder="0.00"
              className="input bg-surface rounded-xl pl-9 py-3 font-display text-2xl font-semibold tabular"
            />
          </div>
        </div>

        {/* Tip percent */}
        <div>
          <label htmlFor="custom-tip" className="label">Tip %</label>
          <div className="grid grid-cols-5 gap-2">
            {QUICK_TIPS.map(pct => (
              <button
                key={pct}
                onClick={() => { setTipPercent(pct); setCustomTip('') }}
                aria-pressed={customTip === '' && tipPercent === pct}
                className={`py-2.5 rounded-lg text-sm font-semibold tabular transition-colors ${
                  customTip === '' && tipPercent === pct
                    ? 'bg-brand text-white'
                    : 'bg-surface border border-line text-white/70 hover:bg-surface-raised hover:text-white'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
          <input
            id="custom-tip"
            inputMode="decimal"
            value={customTip}
            onChange={e => {
              const v = e.target.value
              if (/^\d*\.?\d{0,2}$/.test(v)) setCustomTip(v)
            }}
            placeholder="Custom %"
            className="input bg-surface mt-2"
          />
        </div>

        {/* Split */}
        <div>
          <div className="label">Split Between</div>
          <div className="flex items-center gap-3 bg-surface border border-line-strong rounded-xl px-2 py-2">
            <button
              onClick={() => setPeople(p => Math.max(1, p - 1))}
              aria-label="Fewer people"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white text-lg transition-colors"
            >
              −
            </button>
            <div className="flex-1 text-center">
              <span className="text-lg font-semibold tabular">{people}</span>
              <span className="text-xs text-white/45 ml-1.5">{people === 1 ? 'person' : 'people'}</span>
            </div>
            <button
              onClick={() => setPeople(p => p + 1)}
              aria-label="More people"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white text-lg transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="card shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">Tip Amount</span>
            <span className="text-lg font-semibold text-white tabular">{fmt(tipAmount)}</span>
          </div>
          <div className={`flex items-center justify-between ${people > 1 ? 'pb-3 border-b border-line' : ''}`}>
            <span className="text-white/60 text-sm">Total</span>
            <span className="font-display text-2xl font-semibold text-gold tabular">{fmt(total)}</span>
          </div>

          {people > 1 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">Tip / Person</span>
                <span className="text-sm font-medium text-white tabular">{fmt(tipPerPerson)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-sm">Total / Person</span>
                <span className="text-lg font-semibold text-gold tabular">{fmt(totalPerPerson)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
