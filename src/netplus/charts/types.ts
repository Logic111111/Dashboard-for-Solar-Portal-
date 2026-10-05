export interface LensActions {
  pickMonth: (ym: number) => void;
  pickCapacity: (min: number | null, max: number | null) => void;
  pickInverter: (rating: number) => void;
  showOversized: () => void;
  pickTransformer: (code: string) => void;
  toggleBranch: (id: number) => void;
  toggleCsc: (id: number) => void;
}
