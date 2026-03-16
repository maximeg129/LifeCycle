
"use client";

import React, { useState, useEffect } from 'react';
import { AppNavigation } from '@/components/layout/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth, useFirestore, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ShieldCheck, ExternalLink, Save, Loader2, Key, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  const settingsPath = user ? `users/${user.uid}/settings/intervals` : null;
  const { data: settings, loading: loadingSettings } = useDoc(settingsPath);

  const [athleteId, setAthleteId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setAthleteId(settings.intervalsAthleteId || '');
      setApiKey(settings.intervalsApiKey || '');
    }
  }, [settings]);

  const handleSave = async () => {
    if (!user || !db) return;

    setSaving(true);
    try {
      await setDoc(doc(db, `users/${user.uid}/settings/intervals`), {
        intervalsAthleteId: athleteId,
        intervalsApiKey: apiKey,
      });
      toast({
        title: "Paramètres enregistrés",
        description: "Vos identifiants Intervals.icu ont été mis à jour.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer les paramètres.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />
      
      <main className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0">
          <h1 className="text-3xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground">Gérez vos intégrations et configurations.</p>
        </header>

        <Card className="bg-card/40 border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-accent/20 rounded-lg text-accent">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <CardTitle>Intégration Intervals.icu</CardTitle>
              </div>
              {settings?.intervalsAthleteId && (
                <Badge variant="outline" className="text-accent border-accent/30 bg-accent/5">Connecté</Badge>
              )}
            </div>
            <CardDescription>
              Liez votre compte pour synchroniser vos données de performance et de santé.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-muted/50 rounded-lg border border-border flex items-start gap-4">
              <div className="text-sm space-y-2">
                <p className="font-medium">Où trouver ces informations ?</p>
                <p className="text-muted-foreground leading-relaxed">
                  Connectez-vous à Intervals.icu, allez dans <strong>Settings</strong>, puis descendez jusqu'à la section <strong>API Key</strong>.
                </p>
                <a 
                  href="https://intervals.icu/settings" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-accent hover:underline gap-1 text-xs"
                >
                  Ouvrir Intervals.icu <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="athleteId" className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" /> ID Athlète
                </Label>
                <Input 
                  id="athleteId"
                  placeholder="ex: i12345" 
                  value={athleteId}
                  onChange={(e) => setAthleteId(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-muted-foreground" /> Clé API
                </Label>
                <Input 
                  id="apiKey"
                  type="password"
                  placeholder="Votre clé secrète" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t border-border mt-4 px-6 py-4">
            <Button 
              onClick={handleSave} 
              disabled={saving || loadingSettings}
              className="bg-primary text-primary-foreground hover:bg-primary/90 ml-auto"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Enregistrer les identifiants
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
