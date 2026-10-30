import { create } from 'zustand'
import * as THREE from 'three'
import type { Destination } from './config'

export type Stage = 'intro' | 'reception' | 'guided' | 'finale'
type OfficeState = {
  stage: Stage
  destination: Destination
  arrived: boolean
  visitorPath: THREE.Vector3[]
  receptionistPath: THREE.Vector3[]
  visitorPosition: THREE.Vector3
  receptionistPosition: THREE.Vector3
  soundOn: boolean
  beginReception: () => void
  guideTo: (destination: Destination) => void
  arrive: () => void
  finish: () => void
  restart: () => void
  setVisitorPath: (path: THREE.Vector3[]) => void
  toggleSound: () => void
}

const visitorStart = new THREE.Vector3(-6.3, 0, -9.4)
const receptionistStart = new THREE.Vector3(0, 0, 2.5)

export const useOfficeStore = create<OfficeState>((set) => ({
  stage: 'intro',
  destination: 'Boss Cabin',
  arrived: false,
  visitorPath: [],
  receptionistPath: [],
  visitorPosition: visitorStart.clone(),
  receptionistPosition: receptionistStart.clone(),
  soundOn: false,
  beginReception: () =>
    set({
      stage: 'reception',
      arrived: false,
      visitorPosition: new THREE.Vector3(0, 0, 4.4),
      visitorPath: [],
    }),
  guideTo: (destination) => {
    const target = destination === 'Boss Cabin'
      ? new THREE.Vector3(0, 0, -4.25)
      : destination === 'Work Studio'
        ? new THREE.Vector3(-5.3, 0, -1.5)
        : destination === 'Design Room'
          ? new THREE.Vector3(5.3, 0, -1.5)
          : destination === 'Meeting Room'
            ? new THREE.Vector3(-5.3, 0, -5.3)
            : new THREE.Vector3(5.3, 0, -5.3)
    const route = [new THREE.Vector3(0.8, 0, 1.3), new THREE.Vector3(2.1, 0, 0), new THREE.Vector3(3.5, 0, -1.6), target]
    set({
      stage: 'guided',
      arrived: false,
      destination,
      receptionistPath: route,
      visitorPath: [new THREE.Vector3(0, 0, 3.3), new THREE.Vector3(1.3, 0, 1.6), new THREE.Vector3(2.5, 0, 0), new THREE.Vector3(3.6, 0, -1.5), target.clone()],
    })
  },
  arrive: () => set({ arrived: true }),
  finish: () => set({ stage: 'finale' }),
  restart: () =>
    set({
      stage: 'intro',
      arrived: false,
      destination: 'Boss Cabin',
      visitorPath: [],
      receptionistPath: [],
      visitorPosition: visitorStart.clone(),
      receptionistPosition: receptionistStart.clone(),
    }),
  setVisitorPath: (visitorPath) => set({ visitorPath }),
  toggleSound: () => set((state) => ({ soundOn: !state.soundOn })),
}))
