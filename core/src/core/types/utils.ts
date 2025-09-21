export type Simplify<T> = { [K in keyof T]: T[K] } & {}

export type Selection = {
  [P in string]?: boolean | Selection
}

export type Trues<T extends Selection> = Simplify<{
  [K in keyof T]-?: [T[K] & {}] extends [Selection] ? Trues<T[K] & {}> : true
}>

export type Selector<Props extends string | number | symbol = string> = {
  [P in Props]?: boolean
}

export type Select<T, S> = S extends never
  ? never
  : Simplify<{
      [K in keyof T as K extends keyof S ? (S[K] extends true ? K : never) : never]: T[K]
    }>

export type ConditionalKeys<T, V> = {
  [Key in keyof T]-?: T[Key] extends V
    ? T[Key] extends never
      ? V extends never
        ? Key
        : never
      : Key
    : never
}[keyof T]

export type ConditionalOmit<T, V> = Simplify<Omit<T, ConditionalKeys<T, V>>>
