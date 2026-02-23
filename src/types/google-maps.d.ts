// Google Maps Types for autocomplete
// This allows TypeScript to recognize google.maps APIs

declare global {
  interface Window {
    google: typeof google
  }

  namespace google {
    namespace maps {
      class LatLng {
        constructor(lat: number, lng: number)
        lat(): number
        lng(): number
      }

      class LatLngBounds {
        extend(point: LatLng): void
      }

      interface MapOptions {
        center?: LatLng | { lat: number; lng: number }
        zoom?: number
        mapTypeControl?: boolean
        streetViewControl?: boolean
        fullscreenControl?: boolean
        zoomControl?: boolean
        styles?: any[]
        mapId?: string
      }

      class Map {
        constructor(element: HTMLElement, options?: MapOptions)
        setCenter(center: LatLng | { lat: number; lng: number }): void
        setZoom(zoom: number): void
        fitBounds(bounds: LatLngBounds, padding?: number): void
        panTo(latLng: LatLng | { lat: number; lng: number }): void
      }

      interface MarkerOptions {
        position?: LatLng | { lat: number; lng: number }
        map?: Map | null
        title?: string
        label?: string | { text: string; color?: string; fontSize?: string }
        icon?: any
      }

      class Marker {
        constructor(options?: MarkerOptions)
        setMap(map: Map | null): void
        setPosition(position: LatLng | { lat: number; lng: number }): void
        getPosition(): LatLng | undefined
      }

      interface InfoWindowOptions {
        content?: string | HTMLElement
        position?: LatLng | { lat: number; lng: number }
        maxWidth?: number
      }

      class InfoWindow {
        constructor(options?: InfoWindowOptions)
        open(map?: Map, anchor?: Marker): void
        close(): void
        setContent(content: string | HTMLElement): void
      }

      class Geocoder {
        geocode(
          request: { address: string },
          callback: (
            results: Array<{
              geometry: { location: LatLng }
              formatted_address: string
            }> | null,
            status: string
          ) => void
        ): void
      }

      namespace event {
        function clearInstanceListeners(instance: any): void
      }

      namespace places {
        interface PlaceResult {
          formatted_address?: string
          address_components?: Array<{
            long_name: string
            short_name: string
            types: string[]
          }>
          geometry?: {
            location: LatLng
          }
          name?: string
        }

        interface AutocompleteOptions {
          types?: string[]
          fields?: string[]
          componentRestrictions?: {
            country?: string | string[]
          }
        }

        class Autocomplete {
          constructor(element: HTMLInputElement, options?: AutocompleteOptions)
          addListener(event: string, handler: () => void): void
          getPlace(): PlaceResult
        }
      }
    }
  }
}

export {}
