/**
 * Sphere Volume Calculator
 * Functions for calculating the volume and surface area of a sphere
 */

/**
 * Calculates the volume of a sphere using the radius
 * Formula: V = (4/3) * π * r³
 * 
 * @param radius - The radius of the sphere (must be non-negative)
 * @returns The volume of the sphere
 * @throws Error if radius is negative
 */
export function calculateSphereVolume(radius: number): number {
  if (radius < 0) {
    throw new Error("Radius cannot be negative");
  }
  
  const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
  return volume;
}

/**
 * Calculates the volume of a sphere using the diameter
 * First converts diameter to radius, then uses V = (4/3) * π * r³
 * 
 * @param diameter - The diameter of the sphere (must be non-negative)
 * @returns The volume of the sphere
 * @throws Error if diameter is negative
 */
export function calculateSphereVolumeByDiameter(diameter: number): number {
  if (diameter < 0) {
    throw new Error("Diameter cannot be negative");
  }
  
  // Convert diameter to radius: radius = diameter / 2
  const radius = diameter / 2;
  const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
  return volume;
}

/**
 * Calculates the surface area of a sphere using the radius
 * Formula: A = 4 * π * r²
 * 
 * @param radius - The radius of the sphere (must be non-negative)
 * @returns The surface area of the sphere
 * @throws Error if radius is negative
 */
export function calculateSphereSurfaceArea(radius: number): number {
  if (radius < 0) {
    throw new Error("Radius cannot be negative");
  }
  
  const surfaceArea = 4 * Math.PI * Math.pow(radius, 2);
  return surfaceArea;
}