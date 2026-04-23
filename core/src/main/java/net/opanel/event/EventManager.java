package net.opanel.event;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.function.Consumer;

public class EventManager {
    private static volatile EventManager instance;
    private final ConcurrentHashMap<EventType, Set<Consumer<? extends OPanelEvent>>> listenerMap = new ConcurrentHashMap<>();

    private EventManager() { }

    public <E extends OPanelEvent> void on(EventType type, Consumer<E> listener) {
        Set<Consumer<? extends OPanelEvent>> listeners = listenerMap.computeIfAbsent(type, k -> new CopyOnWriteArraySet<>());
        listeners.add(listener);
    }

    public <E extends OPanelEvent> void off(EventType type, Consumer<E> listener) {
        listenerMap.computeIfPresent(type, (k, listeners) -> {
            listeners.remove(listener);
            return listeners.isEmpty() ? null : listeners;
        });
    }

    @SuppressWarnings("unchecked")
    public <E extends OPanelEvent> void emit(EventType type, E event) {
        Set<Consumer<? extends OPanelEvent>> listeners = listenerMap.get(type);
        if(listeners == null) return;
        for(Consumer<? extends OPanelEvent> listener : listeners) {
            ((Consumer<E>) listener).accept(event);
        }
    }

    public static EventManager get() {
        if(instance == null) {
            synchronized (EventManager.class) {
                if(instance == null) {
                    instance = new EventManager();
                }
            }
        }
        return instance;
    }
}
