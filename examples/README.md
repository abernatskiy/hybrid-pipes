# Hybrid Pipes SDK examples

## Quickstart

```bash
git clone https://github.com/abernatskiy/hybrid-pipes
cd hybrid-pipes/examples
npm i
```

## Data pipelines basics

1. [trivial-pipe](src/01-trivial-pipe.ts): an elementary Portal data pipeline with a source that fetches USDC transfers on a single block + a target that just prints the incoming data.

2. [transformer](src/02-transformer.ts): same pipeline, but with a transformer added in the middle. The transformer takes a `transactionHash` for every Transfer.

3. [query-from-transformer](src/03-query-from-transformer.ts): transformers can send queries to the source! This example's source starts with a blank query. A transformer then adds the USDC Transfers query to the query builder using the `query` callback.

   This enables transformers to combine data selection and processing, creating self-contained modules.

4. createEvmDecoder transformer

5. [parallel-transformers](src/05-parallel-transformers.ts): now there are two transformers simultaneously adding data to the source output. A call
   ```ts
   source.extend({
     field0: transformer0,
     field1: transformer1
   })
   ```
   makes data in the shape of
   ```ts
   {
     ...data_as_it_arrived_from_the_source,
     field0: output_of_transformer0,
     field1: output_of_transformer1
   }
   ```
   The transformers in the example don't send any queries to the source, but if they did the queries would be merged.

6. cursors

7. forks

8. clickhouse

factory stuff?
sqlitePortalCache?
