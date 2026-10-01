export function FldrCardSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="h-6 bg-white/[0.06] rounded-md w-36"></div>
        <div className="h-9 bg-white/[0.06] rounded-lg w-16"></div>
      </div>
      <div className="h-4 bg-white/[0.06] rounded-md w-48 mb-4"></div>
      <div className="flex gap-2">
        <div className="h-6 bg-white/[0.06] rounded-full w-24"></div>
      </div>
    </div>
  )
}

export function FldrListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map(i => (
        <FldrCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function FldrDetailSkeleton() {
  return (
    <div className="animate-pulse min-h-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-4 max-w-2xl mx-auto pt-4">
        <div className="h-6 bg-white/[0.06] rounded-md w-16"></div>
        <div className="h-8 bg-white/[0.06] rounded-lg w-28"></div>
      </div>

      {/* Title */}
      <div className="px-4 max-w-2xl mx-auto mb-6">
        <div className="card p-5">
          <div className="h-7 bg-white/[0.06] rounded-md w-56 mb-3"></div>
          <div className="h-4 bg-white/[0.06] rounded-md w-40 mb-2"></div>
          <div className="h-4 bg-white/[0.06] rounded-md w-28"></div>
        </div>
      </div>

      {/* Modules */}
      <div className="space-y-3 px-4 max-w-2xl mx-auto">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-5">
            <div className="h-5 bg-white/[0.06] rounded-md w-28"></div>
          </div>
        ))}
      </div>
    </div>
  )
}
