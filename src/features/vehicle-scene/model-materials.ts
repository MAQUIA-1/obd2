import { Material, MeshPhysicalMaterial, MeshStandardMaterial } from 'three'

export function displayMaterial(source: Material): Material {
  // The supplied GLB has near-black RGB textures on both glass materials;
  // one is opaque. Those maps are not useful transparency masks.
  if (source.name.includes('glass_ex')) {
    return new MeshPhysicalMaterial({
      name: source.name,
      color: '#e0e8ed',
      metalness: 0,
      roughness: 0.12,
      transmission: 0.9,
      thickness: 0.02,
      ior: 1.45,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      envMapIntensity: 0,
      specularIntensity: 0,
    })
  }

  if (source instanceof MeshStandardMaterial && source.name.includes('body')) {
    const paint = new MeshPhysicalMaterial()
    // Preserve the source textures, with a matte finish and no specular highlight.
    MeshStandardMaterial.prototype.copy.call(paint, source)
    paint.color.set('#f0f1f2')
    paint.metalness = 0
    paint.roughness = 0.85
    paint.clearcoat = 0
    paint.specularIntensity = 0
    paint.envMapIntensity = 0
    return paint
  }

  const material = source.clone()
  if (material instanceof MeshStandardMaterial) {
    material.envMapIntensity = 0
  }
  return material
}
