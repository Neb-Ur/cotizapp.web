// The subset used by the API. Neither routes nor services depend on a storage SDK.
export type Data = Record<string, any>;
export interface DocumentSnapshot { id: string; exists: boolean; ref: DocumentReference; data(): any; }
export interface QuerySnapshot { docs: DocumentSnapshot[]; size: number; empty: boolean; }
export interface DocumentReference { id: string; path: string; get(): Promise<DocumentSnapshot>; set(data: Data, options?: {merge?: boolean}): Promise<any>; update(data: Data): Promise<any>; delete(): Promise<any>; }
export interface Query { get(): Promise<QuerySnapshot>; where(field: string, op: string, value: any): Query; limit(count: number): Query; }
export interface CollectionReference extends Query { doc(id?: string): DocumentReference; add(data: Data): Promise<DocumentReference>; }
export interface WriteBatch { set(ref: DocumentReference, data: Data, options?: {merge?: boolean}): WriteBatch; update(ref: DocumentReference, data: Data): WriteBatch; delete(ref: DocumentReference): WriteBatch; commit(): Promise<any>; }
export interface Transaction extends WriteBatch { get(ref: DocumentReference): Promise<DocumentSnapshot>; get(ref: Query): Promise<QuerySnapshot>; create(ref: DocumentReference, data: Data): Transaction; }
export interface Database { collection(name: string): CollectionReference; batch(): WriteBatch; runTransaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>; }
