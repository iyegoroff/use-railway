import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createRailway } from 'use-railway'

export type { ActionMap, Command, Effect, UpdateMap } from 'use-railway'
export const useRailway = createRailway({ useState, useEffect, useRef, useLayoutEffect })
