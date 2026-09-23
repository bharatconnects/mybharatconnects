export enum Cluster {
  PROPERTY = 'PROPERTY',
  TAX = 'TAX',
  HYBRID = 'HYBRID',
}

export const CLUSTER_LABEL: Record<Cluster, string> = {
  [Cluster.PROPERTY]: 'Property',
  [Cluster.TAX]: 'Tax',
  [Cluster.HYBRID]: 'Hybrid',
};
