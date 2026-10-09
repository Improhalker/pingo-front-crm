<script setup lang="ts">
import {
  chartReferences,
  chartReferenceSrc,
  pingoAssets,
} from '~/config/visual-references'
definePageMeta({ layout: false })
if (!import.meta.dev) throw createError({ statusCode: 404 })
const { resolved } = useTheme()
</script>

<template>
  <main class="reference-gallery">
    <header class="gallery-heading">
      <div>
        <p class="small text-secondary">PingoFin · referências visuais</p>
        <h1>Clareza em cada detalhe.</h1>
        <p class="text-secondary">
          Gráficos, Pingo e conversa. Exemplos visuais com dados ilustrativos.
        </p>
      </div>
      <ThemeSelect />
    </header>
    <section aria-labelledby="dashboard-heading">
      <div class="section-heading">
        <h2 id="dashboard-heading">Prévia do dashboard financeiro</h2>
        <p class="text-secondary">
          Hierarquia do DESIGN_SYSTEM §10: saldo, entradas, saídas, resultado, a
          receber, a pagar e vencimentos. Só nesta galeria de desenvolvimento.
        </p>
      </div>
      <PreviewDashboardPreview />
    </section>
    <section aria-labelledby="charts-heading">
      <div class="section-heading">
        <h2 id="charts-heading">Gráficos para entender o financeiro</h2>
        <p class="text-secondary">
          Composição inspirada no Horizon UI, adaptada ao PingoFin.
        </p>
      </div>
      <div class="reference-charts">
        <figure
          v-for="chart in chartReferences"
          :key="chart.id"
          :class="{ 'wide-chart': chart.id === 'fluxo-caixa' }"
        >
          <img
            :src="chartReferenceSrc(chart.id, resolved)"
            :alt="chart.description"
            width="720"
            height="420"
          />
          <figcaption class="small text-secondary">
            {{ chart.title }} · SVG editável · dados ilustrativos
          </figcaption>
        </figure>
      </div>
    </section>
    <section aria-labelledby="mascot-heading">
      <div class="section-heading">
        <h2 id="mascot-heading">Um Pingo para cada momento</h2>
        <p class="text-secondary">
          Três imagens individuais, com fundo transparente e substituição
          independente.
        </p>
      </div>
      <div class="mascot-examples">
        <figure v-for="(asset, state) in pingoAssets" :key="state" class="card">
          <PingoVisual
            :src="asset.src"
            :alt="asset.alt"
            :width="180"
            :height="180"
          />
          <figcaption>
            {{
              state === 'normal'
                ? 'Boas-vindas'
                : state === 'pensando'
                  ? 'Pensando'
                  : 'Insight'
            }}
          </figcaption>
        </figure>
      </div>
    </section>
    <section aria-labelledby="conversation-heading">
      <div class="section-heading">
        <h2 id="conversation-heading">Sempre por aqui.</h2>
        <p class="text-secondary">
          Prévia da interface. Sem serviço de IA ou dados de uma organização.
        </p>
      </div>
      <PingoChatBox area="preview" />
    </section>
    <footer class="small text-secondary">
      Galeria de desenvolvimento · arquivos em docs/referencias-visuais ·
      imagens do Pingo são exemplos para validação.
    </footer>
  </main>
</template>

<style scoped>
.reference-gallery {
  max-width: 1180px;
  margin: auto;
  padding: var(--space-12) var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}
.gallery-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-6);
}
.gallery-heading h1 {
  margin: var(--space-2) 0 var(--space-3);
}
.section-heading {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}
.reference-charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-6);
}
figure {
  margin: 0;
  min-width: 0;
}
.reference-charts img {
  display: block;
  width: 100%;
  height: auto;
}
.reference-charts figcaption {
  margin-top: var(--space-2);
}
.wide-chart {
  grid-column: 1 / -1;
  max-width: 850px;
}
.mascot-examples {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-6);
}
.mascot-examples figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}
.mascot-examples img {
  object-fit: contain;
}
@media (max-width: 640px) {
  .reference-gallery {
    padding: var(--space-6) var(--space-4);
    gap: var(--space-8);
  }
  .reference-charts,
  .mascot-examples {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
