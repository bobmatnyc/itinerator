/**
 * Segment dependency tracking and cascade adjustment service
 * @module services/dependency
 */

import { createDependencyError } from '../core/errors.js';
import type { DependencyError } from '../core/errors.js';
import { err, ok } from '../core/result.js';
import type { Result } from '../core/result.js';
import type { SegmentId } from '../domain/types/branded.js';
import { SegmentType } from '../domain/types/common.js';
import type { Segment } from '../domain/types/segment.js';

/**
 * Dependency graph data structure
 */
export interface DependencyGraph {
  /** Map of segment ID to segment */
  nodes: Map<SegmentId, Segment>;
  /** Map of segment ID to IDs of segments that depend on it */
  edges: Map<SegmentId, SegmentId[]>;
}

/**
 * Service for managing segment dependencies and cascade adjustments
 */
export class DependencyService {
  /** Time window (in milliseconds) for inferring chronological dependencies (30 minutes) */
  private static readonly CHRONOLOGICAL_WINDOW_MS = 30 * 60 * 1000;

  /**
   * Build a dependency graph from segments
   * @param segments - Array of segments
   * @returns Dependency graph with nodes and edges
   */
  buildGraph(segments: Segment[]): DependencyGraph {
    const nodes = new Map<SegmentId, Segment>();
    const edges = new Map<SegmentId, SegmentId[]>();

    // Build nodes
    for (const segment of segments) {
      nodes.set(segment.id, segment);
    }

    // Build edges from explicit dependencies
    for (const segment of segments) {
      if (segment.dependsOn) {
        for (const dependencyId of segment.dependsOn) {
          if (!edges.has(dependencyId)) {
            edges.set(dependencyId, []);
          }
          edges.get(dependencyId)?.push(segment.id);
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Check for circular dependencies using DFS
   * @param segments - Array of segments to validate
   * @returns Result indicating success or circular dependency error
   */
  validateNoCycles(segments: Segment[]): Result<void, DependencyError> {
    const graph = this.buildGraph(segments);
    const visited = new Set<SegmentId>();
    const recursionStack = new Set<SegmentId>();
    const path: SegmentId[] = [];

    const hasCycleDFS = (segmentId: SegmentId): boolean => {
      visited.add(segmentId);
      recursionStack.add(segmentId);
      path.push(segmentId);

      const dependencies = graph.edges.get(segmentId) || [];
      for (const dependency of dependencies) {
        if (!visited.has(dependency)) {
          if (hasCycleDFS(dependency)) {
            return true;
          }
        } else if (recursionStack.has(dependency)) {
          // Found a cycle
          path.push(dependency);
          return true;
        }
      }

      recursionStack.delete(segmentId);
      path.pop();
      return false;
    };

    // Check each node
    for (const segmentId of graph.nodes.keys()) {
      if (!visited.has(segmentId)) {
        if (hasCycleDFS(segmentId)) {
          return err(
            createDependencyError(
              'CIRCULAR_DEPENDENCY',
              `Circular dependency detected: ${path.join(' -> ')}`,
              path
            )
          );
        }
      }
    }

    return ok(undefined);
  }

  /**
   * Get topological order of segments (dependencies first) using Kahn's algorithm
   * @param segments - Array of segments to sort
   * @returns Result with sorted segments or dependency error
   */
  getTopologicalOrder(segments: Segment[]): Result<Segment[], DependencyError> {
    // First validate no cycles
    const cycleCheck = this.validateNoCycles(segments);
    if (!cycleCheck.success) {
      return cycleCheck;
    }

    const graph = this.buildGraph(segments);
    const inDegree = new Map<SegmentId, number>();
    const result: Segment[] = [];

    // Calculate in-degrees
    for (const segmentId of graph.nodes.keys()) {
      inDegree.set(segmentId, 0);
    }

    for (const segment of segments) {
      if (segment.dependsOn) {
        for (const _dependency of segment.dependsOn) {
          inDegree.set(segment.id, (inDegree.get(segment.id) || 0) + 1);
        }
      }
    }

    // Queue of nodes with no dependencies
    const queue: SegmentId[] = [];
    for (const [segmentId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(segmentId);
      }
    }

    // Process queue
    while (queue.length > 0) {
      const segmentId = queue.shift();
      if (!segmentId) continue;

      const segment = graph.nodes.get(segmentId);
      if (!segment) continue;

      result.push(segment);

      const dependents = graph.edges.get(segmentId) || [];
      for (const depId of dependents) {
        const newDegree = (inDegree.get(depId) || 0) - 1;
        inDegree.set(depId, newDegree);
        if (newDegree === 0) {
          queue.push(depId);
        }
      }
    }

    return ok(result);
  }

  /**
   * Find all segments that depend on a given segment (directly or transitively)
   * @param segments - All segments in the itinerary
   * @param segmentId - The segment ID to find dependents for
   * @returns Array of segment IDs that depend on the given segment
   */
  findDependents(segments: Segment[], segmentId: SegmentId): SegmentId[] {
    const graph = this.buildGraph(segments);
    const dependents = new Set<SegmentId>();
    const queue: SegmentId[] = [segmentId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const directDependents = graph.edges.get(current) || [];

      for (const depId of directDependents) {
        if (!dependents.has(depId)) {
          dependents.add(depId);
          queue.push(depId);
        }
      }
    }

    return Array.from(dependents);
  }

  /**
   * Infer chronological dependencies based on time proximity
   * A segment B depends on segment A if:
   * - B starts within 30 minutes after A ends
   * - B is not a background segment (hotels can run in parallel)
   * @param segments - All segments in the itinerary
   * @returns Map of segment ID to inferred dependency IDs
   */
  inferChronologicalDependencies(segments: Segment[]): Map<SegmentId, SegmentId[]> {
    const chronoDeps = new Map<SegmentId, SegmentId[]>();

    // Sort segments by start time
    const sortedSegments = [...segments].sort(
      (a, b) => a.startDatetime.getTime() - b.startDatetime.getTime()
    );

    for (let i = 0; i < sortedSegments.length; i++) {
      const current = sortedSegments[i];
      if (!current) continue;

      // Skip hotel segments as they are background
      if (current.type === SegmentType.HOTEL) {
        continue;
      }

      const deps: SegmentId[] = [];

      // Check previous segments
      for (let j = i - 1; j >= 0; j--) {
        const previous = sortedSegments[j];
        if (!previous) continue;

        // Skip hotel segments (background)
        if (previous.type === SegmentType.HOTEL) {
          continue;
        }

        // Check if current starts soon after previous ends
        const timeDiff = current.startDatetime.getTime() - previous.endDatetime.getTime();

        if (timeDiff >= 0 && timeDiff <= DependencyService.CHRONOLOGICAL_WINDOW_MS) {
          deps.push(previous.id);
        }
      }

      if (deps.length > 0) {
        chronoDeps.set(current.id, deps);
      }
    }

    return chronoDeps;
  }

  /**
   * Check if two segments would overlap (considering exclusive segment types)
   * Hotels and meetings can overlap with other segments, but flights and transfers cannot
   * @param a - First segment
   * @param b - Second segment
   * @returns True if segments would overlap and conflict
   */
  wouldOverlap(a: Segment, b: Segment): boolean {
    // Check time overlap first
    const timeOverlap = a.startDatetime < b.endDatetime && b.startDatetime < a.endDatetime;

    if (!timeOverlap) {
      return false;
    }

    // Define exclusive segment types (cannot overlap)
    const exclusiveTypes: Set<string> = new Set([SegmentType.FLIGHT, SegmentType.TRANSFER]);

    // If both are exclusive types, they conflict
    if (exclusiveTypes.has(a.type) && exclusiveTypes.has(b.type)) {
      return true;
    }

    // One or both are non-exclusive (can overlap)
    return false;
  }

  /**
   * Validate no exclusive segments overlap after adjustment
   * @param segments - All segments to validate
   * @returns Result indicating success or conflict error
   */
  validateNoConflicts(segments: Segment[]): Result<void, DependencyError> {
    const conflicts: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const segmentA = segments[i];
        const segmentB = segments[j];

        if (segmentA && segmentB && this.wouldOverlap(segmentA, segmentB)) {
          conflicts.push(`${segmentA.id} overlaps with ${segmentB.id}`);
        }
      }
    }

    if (conflicts.length > 0) {
      return err(
        createDependencyError(
          'ADJUSTMENT_FAILED',
          `Segment conflicts detected: ${conflicts.join(', ')}`,
          conflicts
        )
      );
    }

    return ok(undefined);
  }

  /**
   * Adjust dependent segments when a segment is moved
   * Uses HYBRID approach:
   * 1. Explicit dependencies from dependsOn field
   * 2. Chronological auto-detection for overlapping segments
   *
   * @param segments - All segments in the itinerary
   * @param movedSegmentId - The segment that was moved
   * @param timeDelta - The time shift in milliseconds (positive = later, negative = earlier)
   * @returns Updated segments with cascaded time adjustments or error
   */
  adjustDependentSegments(
    segments: Segment[],
    movedSegmentId: SegmentId,
    timeDelta: number
  ): Result<Segment[], DependencyError> {
    // Find the moved segment
    const movedSegment = segments.find((s) => s.id === movedSegmentId);
    if (!movedSegment) {
      return err(
        createDependencyError('MISSING_DEPENDENCY', `Segment ${movedSegmentId} not found`, [
          movedSegmentId,
        ])
      );
    }

    // Build combined dependency graph (explicit + chronological)
    const explicitGraph = this.buildGraph(segments);
    const chronoDeps = this.inferChronologicalDependencies(segments);

    // Merge chronological dependencies into graph
    for (const [segmentId, deps] of chronoDeps.entries()) {
      for (const depId of deps) {
        if (!explicitGraph.edges.has(depId)) {
          explicitGraph.edges.set(depId, []);
        }
        const edges = explicitGraph.edges.get(depId);
        if (edges && !edges.includes(segmentId)) {
          edges.push(segmentId);
        }
      }
    }

    // Create adjustment map
    const adjustments = new Map<SegmentId, number>();
    adjustments.set(movedSegmentId, timeDelta);

    // BFS to propagate adjustments
    const queue: SegmentId[] = [movedSegmentId];
    const visited = new Set<SegmentId>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      visited.add(current);

      const currentAdjustment = adjustments.get(current) || 0;
      const directDependents = explicitGraph.edges.get(current) || [];

      for (const depId of directDependents) {
        if (!visited.has(depId)) {
          // Propagate the same time delta
          adjustments.set(depId, currentAdjustment);
          queue.push(depId);
        }
      }
    }

    // Apply adjustments
    const adjustedSegments = segments.map((segment) => {
      const adjustment = adjustments.get(segment.id);
      if (!adjustment) {
        return segment;
      }

      return {
        ...segment,
        startDatetime: new Date(segment.startDatetime.getTime() + adjustment),
        endDatetime: new Date(segment.endDatetime.getTime() + adjustment),
      };
    });

    // Validate no conflicts
    const validationResult = this.validateNoConflicts(adjustedSegments);
    if (!validationResult.success) {
      return validationResult;
    }

    return ok(adjustedSegments);
  }
}
