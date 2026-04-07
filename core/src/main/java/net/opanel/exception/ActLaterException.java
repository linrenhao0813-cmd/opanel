package net.opanel.exception;

/**
 * {@link ActLaterException} is not really an error but a signal
 * that tells the method caller the logic inside the callee
 * will not be acted immediately, but be acted later.
 */
public class ActLaterException extends RuntimeException {
    public ActLaterException() {
        super();
    }
}
