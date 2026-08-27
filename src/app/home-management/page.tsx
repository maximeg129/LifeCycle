"use client"

import { AppNavigation } from '@/components/layout/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ListChecks, Flower2 } from 'lucide-react'
import { TasksTab } from '@/components/home-management/tasks-tab'
import { PlantsTab } from '@/components/home-management/plants-tab'

export default function HomeManagementPage() {
  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <AppNavigation />

      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
        <header className="mt-16 md:mt-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-primary uppercase tracking-wider">Gestion Maison</h2>
            <h1 className="text-3xl font-bold">Votre routine</h1>
          </div>
        </header>

        <Tabs defaultValue="tasks" className="space-y-6">
          <TabsList className="bg-card/50 border border-border p-1 h-auto flex flex-wrap gap-1">
            <TabsTrigger value="tasks" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2">
              <ListChecks className="w-4 h-4 mr-2" /> Tâches
            </TabsTrigger>
            <TabsTrigger value="plants" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2">
              <Flower2 className="w-4 h-4 mr-2" /> Plantes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <TasksTab />
          </TabsContent>

          <TabsContent value="plants">
            <PlantsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
