"use client"

import React, { useState } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  CloudSun, 
  Wind, 
  Thermometer, 
  Clock, 
  AlertTriangle, 
  Loader2,
  CheckCircle2,
  Sparkles,
  MapPin,
  Search,
  Navigation
} from 'lucide-react'
import { cyclingOutfitRecommendation, type CyclingOutfitRecommendationOutput } from '@/ai/flows/cycling-outfit-recommendation-flow'
import { useToast } from '@/hooks/use-toast'

// Mock Inventory Data
const CLOTHING_INVENTORY = [
  { name: "Maillot thermique Castelli", type: "jersey", temperatureRangeCelsius: "5-15°C", windproof: false, waterproof: false, layer: "mid" },
  { name: "Gilet coupe-vent Rapha", type: "jacket", temperatureRangeCelsius: "8-18°C", windproof: true, waterproof: false, layer: "outer" },
  { name: "Veste Gore-Tex Shakedry", type: "jacket", temperatureRangeCelsius: "5-12°C", windproof: true, waterproof: true, layer: "outer" },
  { name: "Cuissard long hiver Specialized", type: "tights", temperatureRangeCelsius: "0-10°C", windproof: true, waterproof: false, layer: "outer" },
  { name: "Base layer Mérinos", type: "baselayer", temperatureRangeCelsius: "-5-15°C", windproof: false, waterproof: false, layer: "base" },
  { name: "Gants néoprène", type: "gloves", temperatureRangeCelsius: "2-10°C", windproof: true, waterproof: true, layer: "outer" },
  { name: "Couvre-chaussures Castelli", type: "shoe covers", temperatureRangeCelsius: "0-10°C", windproof: true, waterproof: true, layer: "outer" }
]

export default function WeatherAssistant() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [result, setResult] = useState<CyclingOutfitRecommendationOutput | null>(null)
  
  const [location, setLocation] = useState('')
  const [weather, setWeather] = useState({
    temperatureCelsius: 12,
    windSpeedKmh: 20,
    precipitation: "none",
    durationHours: 2
  })

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Géolocalisation non supportée",
        description: "Votre navigateur ne supporte pas la géolocalisation.",
      })
      return
    }

    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        // In a real app, we would fetch weather from an API using lat/lng
        // For now, we simulate finding the location
        setLocation(`Coordonnées: ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`)
        toast({
          title: "Position récupérée",
          description: "Votre position a été identifiée avec succès.",
        })
        setGeoLoading(false)
      },
      (error) => {
        setGeoLoading(false)
        toast({
          variant: "destructive",
          title: "Erreur de localisation",
          description: "Impossible d'accéder à votre position. Vérifiez vos permissions.",
        })
      }
    )
  }

  const handleGetRecommendation = async () => {
    setLoading(true)
    try {
      const recommendation = await cyclingOutfitRecommendation({
        location: location || "Position actuelle",
        currentWeather: weather,
        clothingInventory: CLOTHING_INVENTORY
      })
      setResult(recommendation)
    } catch (error) {
      console.error("Recommendation failed", error)
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "L'IA n'a pas pu générer de recommandation.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      
      <main className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 space-y-2">
          <Badge variant="outline" className="text-accent border-accent/30 gap-1 bg-accent/5 px-3">
            <Sparkles className="w-3 h-3" /> Assistant Intelligent
          </Badge>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CloudSun className="w-10 h-10 text-primary" /> Assistant Météo Vélo
          </h1>
          <p className="text-muted-foreground">Entrez votre lieu ou utilisez la géolocalisation pour obtenir une tenue adaptée.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="md:col-span-1 bg-card/40 border-border h-fit">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="w-4 h-4" /> Localisation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="location">Ville ou Région</Label>
                <div className="relative">
                  <Input 
                    id="location"
                    placeholder="ex: Paris, France" 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="pr-10"
                  />
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full gap-2 border-primary/20 hover:bg-primary/5"
                onClick={handleGeolocation}
                disabled={geoLoading}
              >
                {geoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                Me géolocaliser
              </Button>

              <div className="pt-4 border-t border-border space-y-4">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Météo Manuelle</CardTitle>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-muted-foreground" /> Température (°C)
                  </Label>
                  <Input 
                    type="number" 
                    value={weather.temperatureCelsius} 
                    onChange={(e) => setWeather({...weather, temperatureCelsius: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-muted-foreground" /> Vent (km/h)
                  </Label>
                  <Input 
                    type="number" 
                    value={weather.windSpeedKmh}
                    onChange={(e) => setWeather({...weather, windSpeedKmh: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" /> Durée (heures)
                  </Label>
                  <Input 
                    type="number" 
                    value={weather.durationHours}
                    onChange={(e) => setWeather({...weather, durationHours: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Précipitation</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={weather.precipitation}
                    onChange={(e) => setWeather({...weather, precipitation: e.target.value})}
                  >
                    <option value="none">Aucune</option>
                    <option value="light rain">Pluie légère</option>
                    <option value="heavy rain">Pluie forte</option>
                    <option value="snow">Neige</option>
                  </select>
                </div>
              </div>

              <Button 
                onClick={handleGetRecommendation} 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Analyser ma tenue
              </Button>
            </CardContent>
          </Card>

          <div className="md:col-span-2 space-y-6">
            {!result && !loading && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-xl bg-card/20">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <CloudSun className="w-12 h-12 text-muted-foreground opacity-20" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Prêt pour la route ?</h3>
                <p className="text-muted-foreground max-w-xs">Indiquez votre destination ou utilisez votre position pour que l'IA LifeCycle Pro prépare votre équipement.</p>
              </div>
            )}

            {loading && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-card/20 rounded-xl">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground font-medium">L'IA analyse les conditions à {location || "votre position"}...</p>
                <p className="text-xs text-muted-foreground mt-2 italic">Vérification de l'inventaire vestimentaire...</p>
              </div>
            )}

            {result && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="bg-card/60 border-accent/20 border-2 overflow-hidden">
                  <div className="bg-accent/10 px-6 py-3 border-b border-accent/20 flex items-center justify-between">
                    <span className="text-xs font-bold text-accent uppercase tracking-widest">IA Recommendation</span>
                    {location && <Badge variant="secondary" className="text-[10px]">{location}</Badge>}
                  </div>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-accent" /> Votre Tenue Optimale
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-background/80 p-6 rounded-xl text-sm leading-relaxed border border-border shadow-inner whitespace-pre-wrap italic">
                      "{result.recommendation}"
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Checklist Équipement :</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {result.recommendedItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl group hover:border-accent transition-all hover:shadow-md">
                            <div className="w-3 h-3 rounded-full bg-accent group-hover:scale-125 transition-transform" />
                            <span className="text-sm font-medium">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-yellow-500/5 border-yellow-500/20">
                  <CardContent className="pt-6 flex items-start gap-4">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">Conseil de sécurité</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Les conditions peuvent changer rapidement {location ? `à ${location}` : 'en route'}. Prévoyez toujours une couche de secours compacte.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
