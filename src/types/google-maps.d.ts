// Google Maps Types for autocomplete
// This allows TypeScript to recognize google.maps APIs

declare global {
  interface Window {
    google: typeof google
  }

  namespace google {
    namespace maps {
      class LatLng {
        lat(): number
        lng(): number
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
