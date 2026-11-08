//! Runs network calls on the engine's tokio runtime and hands the result
//! back to the UI thread, which polls it each frame.

use std::future::Future;
use std::sync::{Arc, Mutex};

pub struct Job<T> {
    slot: Arc<Mutex<Option<T>>>,
}

impl<T: Send + 'static> Job<T> {
    pub fn spawn<F>(rt: &tokio::runtime::Handle, ctx: &eframe::egui::Context, fut: F) -> Self
    where
        F: Future<Output = T> + Send + 'static,
    {
        let slot = Arc::new(Mutex::new(None));
        let s2 = slot.clone();
        let ctx = ctx.clone();
        rt.spawn(async move {
            let v = fut.await;
            *s2.lock().unwrap() = Some(v);
            ctx.request_repaint();
        });
        Self { slot }
    }

    /// Takes the result once it is ready.
    pub fn take(&mut self) -> Option<T> {
        self.slot.lock().unwrap().take()
    }
}

/// Polls an optional job; returns the value and clears the job when done.
pub fn poll<T: Send + 'static>(job: &mut Option<Job<T>>) -> Option<T> {
    let v = job.as_mut()?.take();
    if v.is_some() {
        *job = None;
    }
    v
}
