# Graph Report - APKSEMAPAM  (2026-07-10)

## Corpus Check
- 264 files · ~415,438 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 865 nodes · 1397 edges · 78 communities (52 shown, 26 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c1abff87`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 113|Community 113]]
- [[_COMMUNITY_Community 116|Community 116]]
- [[_COMMUNITY_Community 119|Community 119]]
- [[_COMMUNITY_Community 127|Community 127]]
- [[_COMMUNITY_Community 128|Community 128]]
- [[_COMMUNITY_Community 130|Community 130]]
- [[_COMMUNITY_Community 134|Community 134]]
- [[_COMMUNITY_Community 139|Community 139]]
- [[_COMMUNITY_Community 142|Community 142]]
- [[_COMMUNITY_Community 149|Community 149]]
- [[_COMMUNITY_Community 150|Community 150]]
- [[_COMMUNITY_Community 151|Community 151]]
- [[_COMMUNITY_Community 152|Community 152]]
- [[_COMMUNITY_Community 153|Community 153]]
- [[_COMMUNITY_Community 157|Community 157]]
- [[_COMMUNITY_Community 159|Community 159]]
- [[_COMMUNITY_Community 160|Community 160]]
- [[_COMMUNITY_Community 161|Community 161]]
- [[_COMMUNITY_Community 164|Community 164]]
- [[_COMMUNITY_Community 167|Community 167]]
- [[_COMMUNITY_Community 169|Community 169]]
- [[_COMMUNITY_Community 170|Community 170]]
- [[_COMMUNITY_Community 171|Community 171]]
- [[_COMMUNITY_Community 172|Community 172]]
- [[_COMMUNITY_Community 181|Community 181]]
- [[_COMMUNITY_Community 182|Community 182]]
- [[_COMMUNITY_Community 183|Community 183]]
- [[_COMMUNITY_Community 184|Community 184]]
- [[_COMMUNITY_Community 185|Community 185]]
- [[_COMMUNITY_Community 186|Community 186]]
- [[_COMMUNITY_Community 188|Community 188]]
- [[_COMMUNITY_Community 190|Community 190]]
- [[_COMMUNITY_Community 191|Community 191]]
- [[_COMMUNITY_Community 192|Community 192]]
- [[_COMMUNITY_Community 198|Community 198]]
- [[_COMMUNITY_Community 200|Community 200]]
- [[_COMMUNITY_Community 213|Community 213]]
- [[_COMMUNITY_Community 214|Community 214]]
- [[_COMMUNITY_Community 215|Community 215]]
- [[_COMMUNITY_Community 217|Community 217]]

## God Nodes (most connected - your core abstractions)
1. `SyncService` - 31 edges
2. `ConfiguracionPage` - 28 edges
3. `Ticket` - 24 edges
4. `AuthService` - 23 edges
5. `PrinterService` - 21 edges
6. `DeviceService` - 20 edges
7. `compilerOptions` - 20 edges
8. `ConnectivityService` - 20 edges
9. `AbastecimientoPage` - 20 edges
10. `Abastecimiento` - 19 edges

## Surprising Connections (you probably didn't know these)
- `BluetoothPrinterAdapter` --implements--> `PrinterAdapter`  [EXTRACTED]
  FRONT-END-APP/src/app/core/adapters/bluetooth-printer.adapter.ts → FRONT-END-APP/src/app/core/adapters/printer-adapter.interface.ts
- `OfflineAuthCache` --references--> `User`  [EXTRACTED]
  FRONT-END-APP/src/app/core/services/auth.service.ts → FRONT-END-APP/src/app/core/models/models.ts
- `ConsolePrinterAdapter` --implements--> `PrinterAdapter`  [EXTRACTED]
  FRONT-END-APP/src/app/core/services/printer.service.ts → FRONT-END-APP/src/app/core/adapters/printer-adapter.interface.ts
- `AbastecimientoPage` --references--> `Product`  [EXTRACTED]
  FRONT-END-APP/src/app/features/abastecimiento/abastecimiento.page.ts → FRONT-END-APP/src/app/core/models/models.ts
- `AbastecimientoPage` --references--> `Zone`  [EXTRACTED]
  FRONT-END-APP/src/app/features/abastecimiento/abastecimiento.page.ts → FRONT-END-APP/src/app/core/models/models.ts

## Import Cycles
- None detected.

## Communities (78 total, 26 thin omitted)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (26): amount, body, bytes, cents, clean, cleanLabel, cleanValue, contentWidth (+18 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (8): PDO, PDO, Database, AbastecimientoModel, BaseModel, ProductModel, UserModel, ZoneModel

### Community 9 - "Community 9"
Cohesion: 0.04
Nodes (48): dependencies, @angular/animations, @angular/common, @angular/compiler, @angular/core, @angular/forms, @angular/platform-browser, @angular/platform-browser-dynamic (+40 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (14): Request, Request, Closure, Request, App, AbastecimientoController, AuthController, Request (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.05
Nodes (19): ArqueoService, TicketsService, TicketsModule, ApiResponse, ArqueoApiData, ArqueoLocalCache, TicketApiItem, TicketsLocalCache (+11 more)

### Community 22 - "Community 22"
Cohesion: 0.20
Nodes (9): PosPrinter, PosPrinterCandidate, PosPrinterLauncherApp, PosPrinterNativeStatus, PosPrinterPlugin, PosPrinterProbeResult, PosPrinterRawPrintOptions, PosPrinterResolvedAction (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.06
Nodes (25): APP_CONSTANTS, ArqueoApiItem, CatalogsApiData, RawProduct, RawZone, SyncAbastecimientoPayload, SyncAbastecimientoResult, GeoJsonPolygon (+17 more)

### Community 53 - "Community 53"
Cohesion: 0.44
Nodes (6): BluetoothPairedDevice, DEFAULT_PRINTER_CONFIG, PaperWidth, PrinterStatus, PrinterValidation, DeviceBuildInfo

### Community 64 - "Community 64"
Cohesion: 0.16
Nodes (3): routes, ConfiguracionPage, ConfiguracionModule

### Community 67 - "Community 67"
Cohesion: 0.08
Nodes (23): angularCompilerOptions, strictTemplates, compileOnSave, compilerOptions, baseUrl, declaration, downlevelIteration, experimentalDecorators (+15 more)

### Community 81 - "Community 81"
Cohesion: 0.16
Nodes (12): changeActive(), componentDidLoad(), componentDidUpdate(), componentWillLoad(), notifyRouter(), prepareLazyLoaded(), select(), setActive() (+4 more)

### Community 86 - "Community 86"
Cohesion: 0.12
Nodes (7): LoginApiData, MeApiData, SessionData, User, AuthService, OfflineAuthCache, UserCorrelativos

### Community 94 - "Community 94"
Cohesion: 0.17
Nodes (3): AbastecimientoModule, routes, AbastecimientoPage

### Community 95 - "Community 95"
Cohesion: 0.18
Nodes (3): routes, ArqueoPage, ArqueoModule

### Community 102 - "Community 102"
Cohesion: 0.12
Nodes (15): Abastecimientos, Arqueo, Auth, Backend Dispensador de Agua API, Catálogos, Ejemplo login, Ejemplo sincronización de abastecimientos, Endpoints principales (+7 more)

### Community 103 - "Community 103"
Cohesion: 0.12
Nodes (3): Abastecimiento, AbastecimientoService, ConsolePrinterAdapter

### Community 113 - "Community 113"
Cohesion: 0.14
Nodes (13): ignore, autoload, psr-4, config, audit, description, name, App\\ (+5 more)

### Community 116 - "Community 116"
Cohesion: 0.20
Nodes (7): connectedCallback(), disabledChanged(), disconnectedCallback(), enableScrollEvents(), render(), renderLoadingText(), thresholdChanged()

### Community 119 - "Community 119"
Cohesion: 0.26
Nodes (3): Closure, Request, Router

### Community 127 - "Community 127"
Cohesion: 0.23
Nodes (3): DateFilterModalComponent, SharedModule, StatusChipComponent

### Community 128 - "Community 128"
Cohesion: 0.26
Nodes (3): routes, SyncModule, SyncPage

### Community 130 - "Community 130"
Cohesion: 0.21
Nodes (4): addIO(), componentDidLoad(), removeIO(), srcChanged()

### Community 134 - "Community 134"
Cohesion: 0.22
Nodes (3): connectedCallback(), styleMainElement(), updateState()

### Community 139 - "Community 139"
Cohesion: 0.20
Nodes (10): options, assets, index, inlineStyleLanguage, main, outputPath, polyfills, scripts (+2 more)

### Community 142 - "Community 142"
Cohesion: 0.40
Nodes (7): calculateOffset(), calculatePosition(), calculatePull(), calculatePush(), calculateSize(), getColumns(), render()

### Community 150 - "Community 150"
Cohesion: 0.29
Nodes (3): routes, LoginPage, AuthModule

### Community 159 - "Community 159"
Cohesion: 0.29
Nodes (6): cli, analytics, newProjectRoot, projects, $schema, version

### Community 160 - "Community 160"
Cohesion: 0.29
Nodes (7): serve, host, port, builder, configurations, defaultConfiguration, options

### Community 161 - "Community 161"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, types, extends, files, include

### Community 170 - "Community 170"
Cohesion: 0.33
Nodes (6): prefix, projectType, root, schematics, sourceRoot, app

### Community 171 - "Community 171"
Cohesion: 0.33
Nodes (6): development, buildTarget, extractLicenses, namedChunks, optimization, sourceMap

### Community 183 - "Community 183"
Cohesion: 0.40
Nodes (5): configurations, budgets, fileReplacements, outputHashing, certificacion

### Community 184 - "Community 184"
Cohesion: 0.40
Nodes (5): production, budgets, buildTarget, fileReplacements, outputHashing

### Community 185 - "Community 185"
Cohesion: 0.50
Nodes (3): routes, TabsModule, TabsPage

### Community 191 - "Community 191"
Cohesion: 0.50
Nodes (4): architect, build, builder, defaultConfiguration

### Community 192 - "Community 192"
Cohesion: 0.50
Nodes (3): Credenciales mock, Notas, Water App Full

## Knowledge Gaps
- **201 isolated node(s):** `$schema`, `version`, `newProjectRoot`, `projectType`, `schematics` (+196 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Ticket` connect `Community 17` to `Community 4`, `Community 53`, `Community 30`, `Community 103`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `AuthService` connect `Community 86` to `Community 4`, `Community 167`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `ArqueoDaily` connect `Community 17` to `Community 4`, `Community 103`, `Community 105`, `Community 53`, `Community 30`, `Community 95`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `$schema`, `version`, `newProjectRoot` to the rest of the system?**
  _201 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `Community 8` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._
- **Should `Community 9` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._