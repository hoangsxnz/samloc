<script lang="ts">
  interface Props {
    text: string;
    tone: 'gold' | 'danger' | 'warn' | 'info';
  }

  let { text, tone }: Props = $props();
</script>

<span class="event-tag tone-{tone}">{text}</span>

<style>
  .event-tag {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    border-radius: var(--r-full);
    padding: 2px 8px;
    line-height: 14px;
    white-space: nowrap;
    animation: event-tag-in 200ms ease-out;
  }
  .tone-gold {
    background: var(--gold);
    color: var(--on-gold);
  }
  .tone-danger {
    background: var(--danger);
    color: #fff;
  }
  .tone-warn {
    background: var(--warn);
    color: var(--on-gold);
  }
  .tone-info {
    background: var(--info);
    color: #fff;
  }
  @keyframes event-tag-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
