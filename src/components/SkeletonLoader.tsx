export function FldrCardSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 animate-pulse">
      <div className="flex justify-between items-start mb-2">
        <div className="h-5 bg-gray-800 rounded w-32"></div>
        <div className="h-5 bg-gray-800 rounded w-16"></div>
      </div>
      <div className="h-4 bg-gray-800 rounded w-24 mb-3"></div>
      <div className="flex gap-2">
        <div className="h-6 bg-gray-800 rounded w-20"></div>
        <div className="h-6 bg-gray-800 rounded w-20"></div>
      </div>
    </div>
  )
}

export function FldrListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <FldrCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function FldrDetailSkeleton() {
  return (
    <div className="p-4 max-w-lg mx-auto pb-24 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-6 bg-gray-800 rounded w-8"></div>
        <div className="h-6 bg-gray-800 rounded w-24"></div>
      </div>

      {/* Title */}
      <div className="h-8 bg-gray-800 rounded w-48 mb-2"></div>
      
      {/* Status */}
      <div className="h-6 bg-gray-800 rounded w-20 mb-4"></div>

      {/* Date */}
      <div className="h-4 bg-gray-800 rounded w-32 mb-6"></div>

      {/* Modules */}
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="h-5 bg-gray-800 rounded w-24 mb-3"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-800 rounded w-full"></div>
              <div className="h-4 bg-gray-800 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
