# Hybrid Pipes SDK examples

## Quickstart

```bash
git clone https://github.com/abernatskiy/hybrid-pipes
cd hybrid-pipes/examples
npm i
```

## Data pipelines basics

 - [src/basics.ts](src/basics.ts) shows an elementary Portal data pipeline.

source -> target
source -> transformer -> target
source w/o query -> transformer that gives it a query -> target
source -> extend(transformer0, transformer1) -> target
same with a source w/o a query

source -> clickhouse target
source w/o query -> evm decoder -> target

sqlitePortalCache?
factory stuff?