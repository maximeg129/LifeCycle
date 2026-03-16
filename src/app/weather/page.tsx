"use client"

import React, { useState, useEffect } from 'react'
import { AppNavigation } from '@/components/layout/sidebar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  Sparkles
} from 'lucide-react'
import { cyclingOutfitRecommendation, type CyclingOutfitRecommendationOutput } from '@/ai/flows/cycling-outfit-recommendation-flow'

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
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CyclingOutfitRecommendationOutput | null>(null)
  
  // Weather state (could be fetched from API in real app)
  const [weather, setWeather] = useState({
    temperatureCelsius: 12,
    windSpeedKmh: 20,
    precipitation: "light rain",
    durationHours: 2
  })

  const handleGetRecommendation = async () => {
    setLoading(true)
    try {
      const recommendation = await cyclingOutfitRecommendation({
        currentWeather: weather,
        clothingInventory: CLOTHING_INVENTORY
      })
      setResult(recommendation)
    } catch (error) {
      console.error("Recommendation failed", error)
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
          <p className="text-muted-foreground">Recommandations vestimentaires personnalisées basées sur votre inventaire et la météo en direct.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="md:col-span-1 bg-card/40 border-border h-fit">
            <CardHeader>
              <CardTitle className="text-lg">Paramètres du jour</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <Button 
                onClick={handleGetRecommendation} 
                className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Analyser ma tenue
              </Button>
            </CardContent>
          </Card>

          <div className="md:col-span-2 space-y-6">
            {!result && !loading && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-xl bg-card/20">
                <CloudSun className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground">Appuyez sur "Analyser ma tenue" pour obtenir des recommandations d'experts.</p>
              </div>
            )}

            {loading && (
              <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-card/20 rounded-xl">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Consultation de l'expert LifeCycle Pro...</p>
              </div>
            )}

            {result && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="bg-card/60 border-accent/20 border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-accent" /> Votre Tenue Idéale
                      </CardTitle>
                      <Badge variant="outline" className="border-accent text-accent uppercase">IA Recommendation</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-background/80 p-6 rounded-xl text-sm leading-relaxed border border-border shadow-inner whitespace-pre-wrap">
                      {result.recommendation}
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Liste de colisage :</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {result.recommendedItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg group hover:border-accent transition-colors">
                            <div className="w-2 h-2 rounded-full bg-accent group-hover:scale-125 transition-transform" />
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
                    <p className="text-xs text-yellow-500/80">
                      Rappel : Ces recommandations sont basées sur votre inventaire enregistré. N'oubliez pas vos éclairages si vous partez tard !
                    </p>
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